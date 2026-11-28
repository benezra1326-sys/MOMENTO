import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { enforceAvailabilityLimit } from "./availability";
import { isPlanId, isPremium, plans, premiumPlan, tierOf, type Interval, type PlanId, type Tier } from "@/lib/premium";
import { z } from "zod";

/**
 * Paiement Upclose+, trois modes explicites (variable BILLING_MODE) :
 * - « stripe » : Stripe Checkout (clé sk_test_… en test, sk_live_… en réel). Sans clé, les ventes sont fermées.
 * - « simulated » : boutons « Simuler un succès / un refus », aucun débit. Pour la recette.
 * - « off » (défaut en production si rien n'est configuré) : ventes fermées.
 * Jamais de bascule automatique vers le simulateur en production.
 */
export type BillingMode = "stripe" | "simulated" | "off";

export function billingMode(): BillingMode {
  const m = process.env.BILLING_MODE;
  if (m === "stripe") return process.env.STRIPE_SECRET_KEY ? "stripe" : "off";
  if (m === "simulated") return "simulated";
  if (m === "off") return "off";
  if (process.env.STRIPE_SECRET_KEY) return "stripe";
  return process.env.NODE_ENV === "production" ? "off" : "simulated";
}

export function stripeConfigured() {
  return billingMode() === "stripe";
}

/** Destination de retour après l'achat : un chemin interne uniquement. */
export function safeReturn(raw: unknown): string | null {
  return typeof raw === "string" && /^\/(?!\/)[A-Za-z0-9\-_/]*$/.test(raw) && raw.length < 200 ? raw : null;
}

export function stripeIsTestMode() {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

type StripeObj = Record<string, unknown> & { id: string };

function flatten(obj: Record<string, unknown>, prefix = "", out: [string, string][] = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === "object") flatten(v as Record<string, unknown>, key, out);
    else out.push([key, String(v)]);
  }
  return out;
}

async function stripe(method: "GET" | "POST" | "DELETE", path: string, params?: Record<string, unknown>): Promise<StripeObj> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError("INTERNAL", "Paiement non configuré.");
  const body = params ? new URLSearchParams(flatten(params)).toString() : undefined;
  const url = `https://api.stripe.com/v1${path}${method === "GET" && body ? `?${body}` : ""}`;
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${key}`, ...(method === "POST" ? { "content-type": "application/x-www-form-urlencoded" } : {}) },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as (StripeObj & { error?: { message?: string } }) | null;
  if (!res.ok || !json) {
    console.warn(`[billing] Stripe ${res.status}: ${json?.error?.message ?? "réponse illisible"}`);
    throw new AppError("INTERNAL", "Le paiement n'a pas pu démarrer. Réessaie dans un instant.");
  }
  return json;
}

function periodEnd(sub: StripeObj): Date {
  const direct = sub.current_period_end as number | undefined;
  const item = (sub.items as { data?: { current_period_end?: number }[] } | undefined)?.data?.[0]?.current_period_end;
  const ts = direct ?? item;
  return ts ? new Date(ts * 1000) : new Date(Date.now() + 31 * 86400_000);
}

async function applySubscription(userId: string, sub: StripeObj) {
  const status = sub.status as string;
  const active = status === "active" || status === "trialing";
  const end = periodEnd(sub);
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === "string" ? sub.customer : undefined,
      premiumSource: "stripe",
      ...(isPlanId((sub.metadata as Record<string, string> | undefined)?.plan) ? { premiumPlan: (sub.metadata as Record<string, string>).plan } : {}),
      ...((sub.metadata as Record<string, string> | undefined)?.interval ? { premiumInterval: (sub.metadata as Record<string, string>).interval } : {}),
      premiumUntil: active ? end : null,
      premiumCancelAt: sub.cancel_at_period_end ? end : null,
    },
  });
}

/** Renouvellement Stripe : si la date est passée, on relit l'abonnement (pas besoin de webhook). */
export async function refreshPremium<V extends Pick<Viewer, "id" | "premiumUntil">>(viewer: V): Promise<boolean> {
  if (isPremium(viewer)) return true;
  if (!stripeConfigured()) return false;
  const u = await prisma.user.findUnique({ where: { id: viewer.id }, select: { stripeSubscriptionId: true, premiumSource: true } });
  if (!u?.stripeSubscriptionId || u.premiumSource !== "stripe") return false;
  try {
    const sub = await stripe("GET", `/subscriptions/${u.stripeSubscriptionId}`);
    await applySubscription(viewer.id, sub);
    return sub.status === "active" || sub.status === "trialing";
  } catch {
    return false;
  }
}

/** Offre réelle du membre (après relecture Stripe si besoin). */
export async function currentTier(viewer: Pick<Viewer, "id" | "premiumUntil" | "premiumPlan">): Promise<Tier> {
  if (isPremium(viewer)) return tierOf(viewer);
  if (!(await refreshPremium(viewer))) return "free";
  const u = await prisma.user.findUnique({ where: { id: viewer.id }, select: { premiumUntil: true, premiumPlan: true } });
  return tierOf(u);
}

export async function getBilling(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  await refreshPremium(viewer);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { premiumUntil: true, premiumSource: true, premiumCancelAt: true, premiumPlan: true, premiumInterval: true } });
  return {
    premium: isPremium(u),
    tier: tierOf(u),
    interval: (u.premiumInterval ?? "month") as Interval,
    until: u.premiumUntil?.toISOString() ?? null,
    source: u.premiumSource,
    cancelAt: u.premiumCancelAt?.toISOString() ?? null,
    provider: billingMode() === "stripe" ? (stripeIsTestMode() ? "stripe-test" : "stripe") : billingMode(),
  };
}

const checkoutSchema = z.object({
  plan: z.enum(["plus", "black"]).default("plus"),
  interval: z.enum(["month", "year"]).default("month"),
  returnTo: z.string().optional(),
});

export async function startCheckout(viewerIn: Viewer | null, origin: string, raw?: unknown) {
  const viewer = requireActive(viewerIn);
  const mode = billingMode();
  if (mode === "off") throw new AppError("FORBIDDEN", "L'abonnement Upclose+ ouvre bientôt.");
  const input = checkoutSchema.parse(raw ?? {});
  const retour = safeReturn(input.returnTo);
  const plan = input.plan;
  const interval = input.interval;
  const back = retour ? `&retour=${encodeURIComponent(retour)}` : "";
  // Paiement réel : jamais pour un compte d'exemple. Le paiement simulé (recette) reste ouvert à tous les comptes.
  if (viewer.isDemo && mode !== "simulated") throw new AppError("FORBIDDEN", "Les comptes d'exemple ne peuvent pas s'abonner.");
  const tier = await currentTier(viewer);
  if (tier === plan) throw new AppError("CONFLICT", `Tu es déjà membre ${plans[plan].name}.`);
  if (mode === "simulated") {
    const q = new URLSearchParams({ offre: plan, periode: interval, ...(retour ? { retour } : {}) });
    return { url: `/premium/paiement-test?${q}` };
  }
  if (tier !== "free") throw new AppError("CONFLICT", "Pour changer d'offre, résilie d'abord ton abonnement actuel.");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { email: true, stripeCustomerId: true } });
  const session = await stripe("POST", "/checkout/sessions", {
    mode: "subscription",
    locale: "fr",
    client_reference_id: viewer.id,
    ...(u.stripeCustomerId ? { customer: u.stripeCustomerId } : u.email ? { customer_email: u.email } : {}),
    line_items: {
      0: {
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: plans[plan][interval],
          recurring: { interval },
          product_data: { name: plans[plan].name },
        },
      },
    },
    metadata: { userId: viewer.id, plan, interval },
    subscription_data: { metadata: { userId: viewer.id, plan, interval } },
    success_url: `${origin}/premium/merci?session_id={CHECKOUT_SESSION_ID}${back}`,
    cancel_url: `${origin}/premium${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`,
  });
  return { url: session.url as string };
}

/** Retour de Stripe Checkout : on vérifie la session auprès de Stripe avant d'activer Upclose+. */
export async function confirmCheckout(viewerIn: Viewer | null, sessionId: string) {
  const viewer = requireActive(viewerIn);
  if (!stripeConfigured() || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { premium: false };
  const s = await stripe("GET", `/checkout/sessions/${sessionId}`, { expand: { 0: "subscription" } });
  if (s.client_reference_id !== viewer.id) throw new AppError("FORBIDDEN", "Ce paiement ne correspond pas à ton compte.");
  const sub = s.subscription as StripeObj | null;
  if (s.status !== "complete" || !sub || typeof sub !== "object") return { premium: false };
  await applySubscription(viewer.id, sub);
  return { premium: sub.status === "active" || sub.status === "trialing" };
}

const simulateSchema = z.object({
  outcome: z.enum(["success", "failure"]),
  plan: z.enum(["plus", "black"]).default("plus"),
  interval: z.enum(["month", "year"]).default("month"),
});

/** Paiement simulé (mode « simulated » uniquement) : aucun débit, succès ou refus au choix. */
export async function simulatePayment(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireActive(viewerIn);
  if (billingMode() !== "simulated") throw new AppError("FORBIDDEN", "Le paiement simulé n'est pas disponible.");
  const { outcome, plan, interval } = simulateSchema.parse(raw ?? {});
  if (outcome === "failure") throw new AppError("VALIDATION", "Paiement refusé (simulation). Ton offre ne change pas, tu peux réessayer.");
  if ((await currentTier(viewer)) === plan) return { premium: true, plan, until: viewer.premiumUntil?.toISOString() ?? null };
  const until = new Date(Date.now() + (interval === "year" ? 365 : 30) * 86400_000);
  await prisma.user.update({
    where: { id: viewer.id },
    data: { premiumUntil: until, premiumSource: "test", premiumPlan: plan, premiumInterval: interval, premiumCancelAt: null },
  });
  return { premium: true, plan, until: until.toISOString() };
}

/** Suppression de compte : l'abonnement Stripe est arrêté tout de suite, plus aucun prélèvement. */
export async function endBillingForDeletedAccount(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { stripeSubscriptionId: true, premiumSource: true } });
  if (u?.stripeSubscriptionId && u.premiumSource === "stripe" && process.env.STRIPE_SECRET_KEY) {
    await stripe("DELETE", `/subscriptions/${u.stripeSubscriptionId}`);
  }
  await prisma.user.update({ where: { id: userId }, data: { premiumUntil: null, premiumCancelAt: null, premiumSource: null, premiumPlan: null } });
}

/** Résiliation : Stripe garde l'accès jusqu'à la fin du mois payé ; un paiement de test s'arrête tout de suite. */
export async function cancelPremium(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { premiumSource: true, stripeSubscriptionId: true, premiumUntil: true } });
  if (u.premiumSource === "stripe" && u.stripeSubscriptionId && stripeConfigured()) {
    const sub = await stripe("POST", `/subscriptions/${u.stripeSubscriptionId}`, { cancel_at_period_end: "true" });
    await applySubscription(viewer.id, sub);
    return { cancelAt: periodEnd(sub).toISOString(), immediate: false };
  }
  await prisma.user.update({ where: { id: viewer.id }, data: { premiumUntil: null, premiumCancelAt: null, premiumSource: null, premiumPlan: null } });
  // Dispos en trop : gardées en brouillon (jamais supprimées), le membre choisit ensuite laquelle reste active.
  const drafted = await enforceAvailabilityLimit(viewer.id, "free");
  return { cancelAt: new Date().toISOString(), immediate: true, drafted };
}

export async function requirePremium(viewer: Viewer, message: string) {
  if (await refreshPremium(viewer)) return;
  throw new AppError("PREMIUM_REQUIRED", message);
}

export async function requireTier(viewer: Viewer, need: PlanId, message: string): Promise<Tier> {
  const tier = await currentTier(viewer);
  if (tier === "black" || tier === need) return tier;
  throw new AppError("PREMIUM_REQUIRED", message);
}

/** Boost : un Moment à venir est « Mis en avant » dans le feed de sa ville pendant 24 h (un seul à la fois, quota mensuel). */
export async function boostMoment(viewerIn: Viewer | null, momentId: string) {
  const viewer = requireActive(viewerIn);
  const tier = await requireTier(viewer, "plus", "Le boost fait partie d'Upclose+ et d'Upclose Black.");
  const m = await prisma.moment.findUnique({ where: { id: momentId }, select: { hostId: true, status: true, startsAt: true } });
  if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
  if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Seul l'hôte peut booster ce Moment.");
  const now = new Date();
  if (m.status !== "PUBLISHED" || m.startsAt < now) throw new AppError("CONFLICT", "Seul un Moment publié et à venir peut être boosté.");
  const other = await prisma.moment.findFirst({ where: { hostId: viewer.id, id: { not: momentId }, boostedUntil: { gt: now } }, select: { title: true } });
  if (other) throw new AppError("CONFLICT", `« ${other.title} » est déjà boosté. Un seul boost à la fois.`);
  const quota = plans[tier as PlanId].boostsPerMonth;
  const used = await prisma.auditEvent.count({ where: { actorId: viewer.id, action: "moment.boost", createdAt: { gt: new Date(now.getTime() - 30 * 86400_000) } } });
  if (used >= quota) {
    throw new AppError(
      tier === "black" ? "RATE_LIMITED" : "PREMIUM_REQUIRED",
      tier === "black" ? `Tu as utilisé tes ${quota} boosts des 30 derniers jours.` : "Tu as utilisé ton boost du mois. Upclose Black en donne 4 par mois.",
    );
  }
  const until = new Date(Math.min(now.getTime() + premiumPlan.boostHours * 3600_000, m.startsAt.getTime()));
  await prisma.moment.update({ where: { id: momentId }, data: { boostedUntil: until } });
  await prisma.auditEvent.create({ data: { actorId: viewer.id, action: "moment.boost", targetType: "moment", targetId: momentId } });
  return { boostedUntil: until.toISOString() };
}

import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { isPremium, premiumPlan } from "@/lib/premium";
import { z } from "zod";

/**
 * Paiement Upclose+.
 * - STRIPE_SECRET_KEY défini : vrai Stripe Checkout (clé de test sk_test_… : carte 4242 4242 4242 4242, aucun débit).
 * - Sinon : paiement simulé dans l'app, pour tester les fonctions payantes sans compte Stripe.
 */
export function stripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
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

async function stripe(method: "GET" | "POST", path: string, params?: Record<string, unknown>): Promise<StripeObj> {
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

export async function getBilling(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  await refreshPremium(viewer);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { premiumUntil: true, premiumSource: true, premiumCancelAt: true } });
  return {
    premium: isPremium(u),
    until: u.premiumUntil?.toISOString() ?? null,
    source: u.premiumSource,
    cancelAt: u.premiumCancelAt?.toISOString() ?? null,
    provider: stripeConfigured() ? (stripeIsTestMode() ? "stripe-test" : "stripe") : "simulated",
  };
}

export async function startCheckout(viewerIn: Viewer | null, origin: string) {
  const viewer = requireActive(viewerIn);
  if (viewer.isDemo) throw new AppError("FORBIDDEN", "Les comptes d'exemple ne peuvent pas s'abonner.");
  if (await refreshPremium(viewer)) throw new AppError("CONFLICT", "Tu es déjà membre Upclose+.");
  if (!stripeConfigured()) return { url: "/premium/paiement-test" };
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
          unit_amount: premiumPlan.priceCents,
          recurring: { interval: "month" },
          product_data: { name: premiumPlan.name },
        },
      },
    },
    metadata: { userId: viewer.id },
    subscription_data: { metadata: { userId: viewer.id } },
    success_url: `${origin}/premium/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/premium`,
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

const simulateSchema = z.object({ card: z.string().transform((c) => c.replace(/\s+/g, "")) });

/** Paiement simulé (sans Stripe) : mêmes cartes de test que Stripe, aucun débit. */
export async function simulatePayment(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireActive(viewerIn);
  if (stripeConfigured()) throw new AppError("FORBIDDEN", "Le paiement passe par Stripe.");
  if (viewer.isDemo) throw new AppError("FORBIDDEN", "Les comptes d'exemple ne peuvent pas s'abonner.");
  const { card } = simulateSchema.parse(raw ?? {});
  if (card === "4000000000000002") throw new AppError("VALIDATION", "Carte refusée (carte de test « refus »).", { card: "Carte refusée." });
  if (!/^\d{16}$/.test(card)) throw new AppError("VALIDATION", "Numéro de carte invalide.", { card: "16 chiffres." });
  const until = new Date(Date.now() + 30 * 86400_000);
  await prisma.user.update({ where: { id: viewer.id }, data: { premiumUntil: until, premiumSource: "test", premiumCancelAt: null } });
  return { premium: true, until: until.toISOString() };
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
  await prisma.user.update({ where: { id: viewer.id }, data: { premiumUntil: null, premiumCancelAt: null, premiumSource: null } });
  return { cancelAt: new Date().toISOString(), immediate: true };
}

export async function requirePremium(viewer: Viewer, message: string) {
  if (await refreshPremium(viewer)) return;
  throw new AppError("PREMIUM_REQUIRED", message);
}

/** Boost : un Moment à venir de l'hôte passe en tête du feed de sa ville pendant 24 h (un seul à la fois). */
export async function boostMoment(viewerIn: Viewer | null, momentId: string) {
  const viewer = requireActive(viewerIn);
  await requirePremium(viewer, "Le boost fait partie d'Upclose+.");
  const m = await prisma.moment.findUnique({ where: { id: momentId }, select: { hostId: true, status: true, startsAt: true } });
  if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
  if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Seul l'hôte peut booster ce Moment.");
  const now = new Date();
  if (m.status !== "PUBLISHED" || m.startsAt < now) throw new AppError("CONFLICT", "Seul un Moment publié et à venir peut être boosté.");
  const other = await prisma.moment.findFirst({ where: { hostId: viewer.id, id: { not: momentId }, boostedUntil: { gt: now } }, select: { title: true } });
  if (other) throw new AppError("CONFLICT", `« ${other.title} » est déjà boosté. Un seul boost à la fois.`);
  const until = new Date(Math.min(now.getTime() + premiumPlan.boostHours * 3600_000, m.startsAt.getTime()));
  await prisma.moment.update({ where: { id: momentId }, data: { boostedUntil: until } });
  return { boostedUntil: until.toISOString() };
}

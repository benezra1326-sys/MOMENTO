import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { boostMoment, cancelPremium, getBilling, simulatePayment, startCheckout } from "@/server/billing";
import { myViews, suggestPeople } from "@/server/black";
import { getFeed, getMomentDetail } from "@/server/moments";
import { requestToJoin } from "@/server/memberships";
import type { Viewer } from "@/lib/auth";
import { makeMoment, makeUser, resetDb } from "./helpers";

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}
async function fresh(v: Viewer): Promise<Viewer> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: v.id } });
  return { ...v, premiumUntil: u.premiumUntil, premiumPlan: u.premiumPlan };
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("Upclose+", () => {
  it("sans Stripe, le paiement passe par la page de test, et une carte refusée échoue", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const u = await makeUser("Payeur");
    expect(await startCheckout(u, "https://upclose.world")).toEqual({ url: "/premium/paiement-test?offre=plus&periode=month" });
    await expectCode(simulatePayment(u, { outcome: "failure" }), "VALIDATION");
    const r = await simulatePayment(u, { outcome: "success" });
    expect(r.premium).toBe(true);
    expect((await getBilling(await fresh(u))).premium).toBe(true);
    await cancelPremium(u);
    expect((await getBilling(await fresh(u))).premium).toBe(false);
  });

  it("offre gratuite : 3 Moments à venir, le 4e demande Upclose+", async () => {
    const host = await makeUser("Hôte");
    for (let i = 0; i < 3; i++) await makeMoment(host, { title: `Moment numéro ${i}` });
    await expectCode(makeMoment(host, { title: "Moment numéro 4" }), "PREMIUM_REQUIRED");
    await simulatePayment(host, { outcome: "success" });
    await makeMoment(await fresh(host), { title: "Moment numéro 4" });
  });

  it("boost réservé à Upclose+, met le Moment en tête et une seule fois à la fois", async () => {
    const host = await makeUser("Hôte");
    const a = await makeMoment(host, { title: "Moment A" });
    const b = await makeMoment(host, { title: "Moment B" });
    await expectCode(boostMoment(host, b), "PREMIUM_REQUIRED");
    await simulatePayment(host, { outcome: "success" });
    const h = await fresh(host);
    await boostMoment(h, b);
    await expectCode(boostMoment(h, a), "CONFLICT");
    const viewer = await makeUser("Lecteur");
    const feed = await getFeed(viewer, { sort: "best" });
    expect(feed.items[0].id).toBe(b);
  });

  it("Black : Moment réservé, quotas de boost, vues et suggestions", async () => {
    const host = await makeUser("Hôte");
    await expectCode(makeMoment(host, { blackOnly: true }), "PREMIUM_REQUIRED");
    await simulatePayment(host, { outcome: "success", plan: "black" });
    const h = await fresh(host);
    const m = await makeMoment(h, { blackOnly: true, title: "Dîner sélectif" });
    const plus = await makeUser("Plus");
    await simulatePayment(plus, { outcome: "success", plan: "plus" });
    await expectCode(requestToJoin(await fresh(plus), m, {}), "PREMIUM_REQUIRED");
    const black = await makeUser("Black");
    await simulatePayment(black, { outcome: "success", plan: "black" });
    await requestToJoin(await fresh(black), m, {});

    // Vues : comptées une fois par jour, visibles par un membre Black.
    await getMomentDetail(await fresh(plus), m);
    await getMomentDetail(await fresh(plus), m);
    const v = await myViews(h);
    expect(v.unlocked).toBe(true);
    expect(v.rows.find((r) => r.person.id === plus.id)?.moments.map((x) => x.title)).toEqual(["Dîner sélectif"]);
    const locked = await myViews(await fresh(plus));
    expect(locked.unlocked).toBe(false);

    // Upclose+ : 1 boost par mois.
    const pm = await makeMoment(await fresh(plus), { title: "Moment de Plus" });
    await boostMoment(await fresh(plus), pm);
    await prisma.moment.update({ where: { id: pm }, data: { boostedUntil: null } });
    await expectCode(boostMoment(await fresh(plus), pm), "PREMIUM_REQUIRED");

    expect((await suggestPeople(await fresh(plus))).unlocked).toBe(false);
    expect((await suggestPeople(h)).unlocked).toBe(true);
  });

  it("la fiche d'un Moment partagé se lit sans compte, sans adresse ni participants", async () => {
    const host = await makeUser("Hôte");
    const m = await makeMoment(host, { addressMembersOnly: false });
    const d = await getMomentDetail(null, m);
    expect(d.title).toBeTruthy();
    expect(d.address).toBeNull();
    expect(d.attendees).toEqual([]);
  });
});

describe("modes de paiement", () => {
  it("en production sans configuration, les ventes sont fermées (pas de simulateur)", async () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = { node: env.NODE_ENV, mode: env.BILLING_MODE };
    env.NODE_ENV = "production";
    delete env.BILLING_MODE;
    delete env.STRIPE_SECRET_KEY;
    try {
      const u = await makeUser("Payeur");
      await expectCode(startCheckout(u, "https://upclose.world"), "FORBIDDEN");
      await expectCode(simulatePayment(u, { outcome: "success" }), "FORBIDDEN");
      env.BILLING_MODE = "simulated";
      expect((await startCheckout(u, "https://upclose.world", { returnTo: "/moments/abc" })).url).toBe("/premium/paiement-test?offre=plus&periode=month&retour=%2Fmoments%2Fabc");
      expect((await startCheckout(u, "https://upclose.world", { returnTo: "//evil.com", plan: "black", interval: "year" })).url).toBe("/premium/paiement-test?offre=black&periode=year");
    } finally {
      env.NODE_ENV = prev.node;
      if (prev.mode === undefined) delete env.BILLING_MODE;
      else env.BILLING_MODE = prev.mode;
    }
  });
});

describe("parcours complet gratuit → Upclose+ → Black → gratuit", () => {
  it("applique les bonnes limites à chaque étape et ne perd rien au retour au gratuit", async () => {
    const TZ = "Europe/Madrid";
    const { utcToZonedLocal } = await import("@/lib/time");
    const { createAvailability, myAvailabilities, updateAvailability } = await import("@/server/availability");
    const { listMessages, postMessage } = await import("@/server/messages");
    const day = (n: number) => utcToZonedLocal(new Date(Date.now() + n * 86400_000), TZ).slice(0, 10);
    const dispo = (n: number) => ({ date: day(n), slot: "evening", timezone: TZ, city: "Marbella", area: "Centre", categories: [], note: "" });

    // Gratuit
    let u = await makeUser("Parcours");
    await createAvailability(u, dispo(1));
    await expectCode(createAvailability(u, dispo(2)), "AVAILABILITY_LIMIT");
    const moments: string[] = [];
    for (let i = 0; i < 3; i++) moments.push(await makeMoment(u, { title: `Moment du parcours ${i}` }));
    await expectCode(makeMoment(u, { title: "Moment du parcours 4" }), "PREMIUM_REQUIRED");
    await expectCode(boostMoment(u, moments[0]), "PREMIUM_REQUIRED");
    expect((await myViews(u)).unlocked).toBe(false);

    // Upclose+
    await simulatePayment(u, { outcome: "success", plan: "plus" });
    u = await fresh(u);
    expect((await getBilling(u)).tier).toBe("plus");
    await createAvailability(u, dispo(2));
    await createAvailability(u, dispo(3));
    moments.push(await makeMoment(u, { title: "Moment du parcours 4" }));
    await boostMoment(u, moments[0]);
    expect((await myViews(u)).unlocked).toBe(false);
    await expectCode(makeMoment(u, { title: "Moment réservé", blackOnly: true }), "PREMIUM_REQUIRED");

    // Black
    await simulatePayment(u, { outcome: "success", plan: "black" });
    u = await fresh(u);
    expect((await getBilling(u)).tier).toBe("black");
    expect((await myViews(u)).unlocked).toBe(true);
    expect((await suggestPeople(u)).unlocked).toBe(true);
    const reserved = await makeMoment(u, { title: "Moment réservé Black", blackOnly: true });
    await postMessage(u, reserved, { body: "Bienvenue à toutes et à tous" });

    // Retour au gratuit
    const r = await cancelPremium(u);
    expect(r.drafted).toBe(2);
    u = await fresh(u);
    expect((await getBilling(u)).tier).toBe("free");
    const mine = await myAvailabilities(u);
    expect(mine).toHaveLength(3);
    expect(mine.filter((a) => !a.hidden)).toHaveLength(1);
    // Les Moments déjà organisés et leur discussion restent accessibles.
    for (const id of [...moments, reserved]) expect((await getMomentDetail(u, id)).status).toBe("PUBLISHED");
    expect((await listMessages(u, reserved)).map((m) => m.body)).toEqual(["Bienvenue à toutes et à tous"]);
    // Choisir la dispo qui reste active.
    const draft = mine.find((a) => a.hidden)!;
    const active = mine.find((a) => !a.hidden)!;
    await expectCode(updateAvailability(u, draft.id, { hidden: false }), "AVAILABILITY_LIMIT");
    await updateAvailability(u, draft.id, { hidden: false, replaceId: active.id });
    const after = await myAvailabilities(u);
    expect(after.filter((a) => !a.hidden).map((a) => a.id)).toEqual([draft.id]);
  });
});

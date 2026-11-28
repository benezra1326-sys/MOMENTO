import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { boostMoment, cancelPremium, getBilling, simulatePayment, startCheckout } from "@/server/billing";
import { getFeed, getMomentDetail } from "@/server/moments";
import { requestToJoin } from "@/server/memberships";
import type { Viewer } from "@/lib/auth";
import { makeMoment, makeUser, resetDb } from "./helpers";

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}
async function fresh(v: Viewer): Promise<Viewer> {
  const u = await prisma.user.findUniqueOrThrow({ where: { id: v.id } });
  return { ...v, premiumUntil: u.premiumUntil };
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("Upclose+", () => {
  it("sans Stripe, le paiement passe par la page de test, et une carte refusée échoue", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const u = await makeUser("Payeur");
    expect(await startCheckout(u, "https://upclose.world")).toEqual({ url: "/premium/paiement-test" });
    await expectCode(simulatePayment(u, { card: "4000 0000 0000 0002" }), "VALIDATION");
    const r = await simulatePayment(u, { card: "4242 4242 4242 4242" });
    expect(r.premium).toBe(true);
    expect((await getBilling(await fresh(u))).premium).toBe(true);
    await cancelPremium(u);
    expect((await getBilling(await fresh(u))).premium).toBe(false);
  });

  it("offre gratuite : 3 Moments à venir, le 4e demande Upclose+", async () => {
    const host = await makeUser("Hôte");
    for (let i = 0; i < 3; i++) await makeMoment(host, { title: `Moment numéro ${i}` });
    await expectCode(makeMoment(host, { title: "Moment numéro 4" }), "PREMIUM_REQUIRED");
    await simulatePayment(host, { card: "4242424242424242" });
    await makeMoment(await fresh(host), { title: "Moment numéro 4" });
  });

  it("boost réservé à Upclose+, met le Moment en tête et une seule fois à la fois", async () => {
    const host = await makeUser("Hôte");
    const a = await makeMoment(host, { title: "Moment A" });
    const b = await makeMoment(host, { title: "Moment B" });
    await expectCode(boostMoment(host, b), "PREMIUM_REQUIRED");
    await simulatePayment(host, { card: "4242424242424242" });
    const h = await fresh(host);
    await boostMoment(h, b);
    await expectCode(boostMoment(h, a), "CONFLICT");
    const viewer = await makeUser("Lecteur");
    const feed = await getFeed(viewer, { sort: "best" });
    expect(feed.items[0].id).toBe(b);
  });

  it("les demandes des membres Upclose+ passent en premier chez l'hôte", async () => {
    const host = await makeUser("Hôte");
    const m = await makeMoment(host, { visibility: "REQUEST" });
    const free = await makeUser("Gratuit");
    const plus = await makeUser("Plus");
    await requestToJoin(free, m, {});
    await simulatePayment(plus, { card: "4242424242424242" });
    await requestToJoin(await fresh(plus), m, {});
    const d = await getMomentDetail(host, m);
    const pending = d.members!.filter((r) => r.status === "PENDING");
    expect(pending[0].user.id).toBe(plus.id);
    expect(pending[0].premium).toBe(true);
  });
});

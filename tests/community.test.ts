import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Viewer } from "@/lib/auth";
import { getFeed, getMomentDetail } from "@/server/moments";
import { listMessages, postMessage } from "@/server/messages";
import { rateTargets, reputations, submitRatings } from "@/server/ratings";
import { suggestInvitees } from "@/server/matching";
import { createAvailability } from "@/server/availability";
import { utcToZonedLocal } from "@/lib/time";
import { makeMoment, makeUser, resetDb } from "./helpers";

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

async function accept(momentId: string, user: Viewer, host: Viewer) {
  await prisma.momentMembership.create({ data: { momentId, userId: user.id, initiatorId: host.id, kind: "INVITE", status: "ACCEPTED", respondedAt: new Date() } });
}

/** Fait passer un Moment dans le passé (terminé depuis une heure). */
async function endMoment(id: string) {
  await prisma.moment.update({ where: { id }, data: { startsAt: new Date(Date.now() - 4 * 3600_000), endsAt: new Date(Date.now() - 3600_000) } });
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("espace adulte", () => {
  it("refuse la catégorie adulte sans opt-in, et ne l'affiche jamais dans le feed par défaut", async () => {
    const plain = await makeUser("Plain");
    await expectCode(makeMoment(plain, { category: "adult" }), "ADULT_ONLY");

    const host = await makeUser("Host", { adult: true });
    const id = await makeMoment(host, { category: "adult", visibility: "REQUEST" });
    const other = await makeUser("Other");
    expect((await getFeed(other, {})).items.map((m) => m.id)).not.toContain(id);
    expect((await getFeed(null, {})).items.map((m) => m.id)).not.toContain(id);
    await expectCode(getMomentDetail(other, id), "ADULT_ONLY");

    const optedIn = await makeUser("Opted", { adult: true });
    expect((await getFeed(optedIn, {})).items.map((m) => m.id)).toContain(id);
  });

  it("interdit un Moment adulte public", async () => {
    const host = await makeUser("Host", { adult: true });
    await expect(makeMoment(host, { category: "adult", visibility: "PUBLIC" })).rejects.toBeInstanceOf(Error);
  });
});

describe("discussion du Moment", () => {
  it("réservée à l'hôte et aux participants confirmés", async () => {
    const host = await makeUser("Host");
    const guest = await makeUser("Guest");
    const stranger = await makeUser("Stranger");
    const id = await makeMoment(host);
    await accept(id, guest, host);
    await postMessage(guest, id, { body: "On se retrouve devant ?" });
    const msgs = await listMessages(host, id);
    expect(msgs.map((m) => m.body)).toContain("On se retrouve devant ?");
    await expectCode(postMessage(stranger, id, { body: "Coucou" }), "FORBIDDEN");
  });
});

describe("notes après un Moment", () => {
  it("seules les personnes présentes notent ; la moyenne n'apparaît qu'à partir de 3 avis", async () => {
    const host = await makeUser("Host");
    const guests = [await makeUser("G1"), await makeUser("G2"), await makeUser("G3")];
    const id = await makeMoment(host, { capacity: 5 });
    for (const g of guests) await accept(id, g, host);
    await endMoment(id);

    const stranger = await makeUser("Stranger");
    await expect(rateTargets(stranger, id)).rejects.toBeInstanceOf(AppError);

    const rate = (v: Viewer, s: number) =>
      submitRatings(v, id, { ratings: [{ userId: host.id, punctuality: s, ambiance: s, respect: s, organisation: s, accuracy: s }] });
    await rate(guests[0], 5);
    await rate(guests[1], 5);
    let rep = (await reputations([host.id])).get(host.id)!;
    expect(rep.avg).toBeNull();
    await rate(guests[2], 4);
    rep = (await reputations([host.id])).get(host.id)!;
    expect(rep.avg).toBeCloseTo(4.7, 1);
    expect(rep.rankScore).toBeGreaterThan(4);

    // Pas de double note.
    expect((await rate(guests[0], 1)).saved).toBe(0);
  });

  it("une absence fait reculer au classement sans entrer dans la moyenne", async () => {
    const host = await makeUser("Host");
    const g = [await makeUser("G1"), await makeUser("G2")];
    const id = await makeMoment(host, { capacity: 5 });
    for (const x of g) await accept(id, x, host);
    await endMoment(id);
    await submitRatings(host, id, { ratings: [{ userId: g[0].id, noShow: true }] });
    const rep = (await reputations([g[0].id])).get(g[0].id)!;
    expect(rep.noShows).toBe(1);
    expect(rep.count).toBe(0);
    expect(rep.rankScore).toBeLessThan(4);
  });
});

describe("matching pour l'hôte", () => {
  it("propose les personnes dispo au même moment dans la même ville, avec les raisons", async () => {
    const host = await makeUser("Host");
    const free = await makeUser("Free");
    const tz = "Europe/Madrid";
    const date = utcToZonedLocal(new Date(Date.now() + 2 * 86400_000), tz).slice(0, 10);
    await createAvailability(free, { date, slot: "evening", timezone: tz, city: "Marbella", area: "Plage", categories: ["sunset"], note: "" });
    const id = await makeMoment(host, { startsAtLocal: `${date}T20:00`, category: "sunset" });
    const s = await suggestInvitees(host, id);
    expect(s.map((x) => x.person.username)).toContain(free.username);
    expect(s[0].reasons.join(" ")).toMatch(/Dispo/);
    await expectCode(suggestInvitees(free, id), "FORBIDDEN");
  });
});

import { afterAll, beforeEach, describe, expect, it } from "vitest";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Viewer } from "@/lib/auth";
import { momentsToRate, reputations, submitRatings } from "@/server/ratings";
import { myVerification, onProfilePhotoChanged, pendingVerifications, reviewVerification, startVerification, submitSelfie } from "@/server/verification";
import { toPerson } from "@/server/mappers";
import { makeMoment, makeUser, resetDb } from "./helpers";

process.env.STORAGE_DRIVER = "local";
delete process.env.ANTHROPIC_API_KEY;

async function accept(momentId: string, user: Viewer, host: Viewer) {
  await prisma.momentMembership.create({ data: { momentId, userId: user.id, initiatorId: host.id, kind: "INVITE", status: "ACCEPTED", respondedAt: new Date() } });
}
async function endMoment(id: string) {
  await prisma.moment.update({ where: { id }, data: { startsAt: new Date(Date.now() - 4 * 3600_000), endsAt: new Date(Date.now() - 3600_000) } });
}

beforeEach(async () => {
  await resetDb();
  await prisma.photoVerification.deleteMany();
});
afterAll(() => prisma.$disconnect());

describe("notation façon « après la course »", () => {
  it("étoiles + qualités : points forts sur le profil, « referaient » et remarques jamais affichées", async () => {
    const host = await makeUser("Host");
    const guests = [await makeUser("G1"), await makeUser("G2"), await makeUser("G3")];
    const id = await makeMoment(host, { capacity: 5 });
    for (const g of guests) await accept(id, g, host);
    await endMoment(id);

    // Une invite dans le fil, et une notification une seule fois.
    const prompt = await momentsToRate(guests[0]);
    expect(prompt[0].id).toBe(id);
    expect(prompt[0].people.map((p) => p.id)).toContain(host.id);
    await momentsToRate(guests[0]);
    expect(await prisma.notification.count({ where: { userId: guests[0].id, type: "RATE_MOMENT" } })).toBe(1);

    await submitRatings(guests[0], id, { ratings: [{ userId: host.id, stars: 5, tags: ["sympa", "ponctuel", "organise"], again: true }] });
    await submitRatings(guests[1], id, { ratings: [{ userId: host.id, stars: 5, tags: ["sympa", "inconnu"], again: true }] });
    await submitRatings(guests[2], id, { ratings: [{ userId: host.id, stars: 3, tags: ["retard"], again: false }] });

    const rep = (await reputations([host.id])).get(host.id)!;
    expect(rep.avg).toBeCloseTo(4.3, 1);
    expect(rep.qualities.map((q) => [q.id, q.count])).toEqual([["sympa", 2], ["ponctuel", 1], ["organise", 1]]);
    expect(rep.qualities.some((q) => q.id === "retard")).toBe(false);
    expect(rep.againPct).toBe(67);
    // « En retard » fait baisser la ponctualité (5, 5 et 2 au plus).
    expect(rep.criteria.punctuality).toBeCloseTo(4, 1);
    expect(rep.badges).toContain("Très sympa");

    const saved = await prisma.rating.findFirstOrThrow({ where: { raterId: guests[1].id } });
    expect(saved.tags).toEqual(["sympa"]);

    // L'hôte est noté : il ne reste que les autres participants.
    const left = await momentsToRate(guests[0]);
    expect(left[0].people.map((p) => p.id)).not.toContain(host.id);
    expect(left[0].left).toBe(2);
  });

  it("les qualités d'hôte sont ignorées pour un participant ; une note en étoiles est obligatoire", async () => {
    const host = await makeUser("Host");
    const g = await makeUser("G");
    const id = await makeMoment(host, { capacity: 5 });
    await accept(id, g, host);
    await endMoment(id);
    await expect(submitRatings(host, id, { ratings: [{ userId: g.id, tags: ["sympa"] }] })).rejects.toBeInstanceOf(AppError);
    await submitRatings(host, id, { ratings: [{ userId: g.id, stars: 4, tags: ["organise", "drole"] }] });
    const r = await prisma.rating.findFirstOrThrow({ where: { raterId: host.id } });
    expect(r.tags).toEqual(["drole"]);
    expect(r.organisation).toBeNull();
  });
});

async function selfieFile() {
  const buf = await sharp({ create: { width: 400, height: 400, channels: 3, background: "#c88" } }).jpeg().toBuffer();
  return new File([new Uint8Array(buf)], "selfie.jpg", { type: "image/jpeg" });
}

describe("certification de la photo", () => {
  it("selfie en direct → en attente → validé par l'équipe → badge ; changer de photo le retire et relance la vérification", async () => {
    const u = await makeUser("Léa");
    await expect(startVerification(u)).rejects.toBeInstanceOf(AppError); // pas de photo de profil
    await prisma.user.update({ where: { id: u.id }, data: { photoUrl: "/uploads/avatar/a.webp" } });

    const ch = await startVerification(u);
    expect(ch.gesture.label).toBeTruthy();
    let st = await submitSelfie(u, ch.id, await selfieFile());
    expect(st.status).toBe("pending");
    expect(st.verified).toBe(false);
    // La même demande ne peut pas servir deux fois.
    await expect(submitSelfie(u, ch.id, await selfieFile())).rejects.toBeInstanceOf(AppError);

    const member = await makeUser("Membre");
    await expect(pendingVerifications(member)).rejects.toBeInstanceOf(AppError);
    const admin = await makeUser("Admin", { role: "ADMIN" });
    const queue = await pendingVerifications(admin);
    expect(queue).toHaveLength(1);
    await reviewVerification(admin, queue[0].id, { approve: true });

    st = await myVerification(u);
    expect(st.verified).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(toPerson(row).verified).toBe(true);
    expect(await prisma.notification.count({ where: { userId: u.id, type: "PHOTO_VERIFIED" } })).toBe(1);

    await prisma.user.update({ where: { id: u.id }, data: { photoUrl: "/uploads/avatar/b.webp" } });
    await onProfilePhotoChanged(u.id, "/uploads/avatar/b.webp");
    st = await myVerification(u);
    expect(st.verified).toBe(false);
    expect(st.status).toBe("pending");
    const again = await pendingVerifications(admin);
    expect(again[0].photoUrl).toBe("/uploads/avatar/b.webp");
  });

  it("une demande expire après 10 minutes, et un refus est expliqué", async () => {
    const u = await makeUser("Max");
    await prisma.user.update({ where: { id: u.id }, data: { photoUrl: "/uploads/avatar/m.webp" } });
    const ch = await startVerification(u);
    await prisma.photoVerification.update({ where: { id: ch.id }, data: { createdAt: new Date(Date.now() - 11 * 60_000) } });
    await expect(submitSelfie(u, ch.id, await selfieFile())).rejects.toBeInstanceOf(AppError);

    const ch2 = await startVerification(u);
    await submitSelfie(u, ch2.id, await selfieFile());
    const admin = await makeUser("Admin", { role: "ADMIN" });
    await reviewVerification(admin, (await pendingVerifications(admin))[0].id, { approve: false, reason: "Visage non visible." });
    const st = await myVerification(u);
    expect(st.status).toBe("rejected");
    expect(st.reason).toBe("Visage non visible.");
  });
});

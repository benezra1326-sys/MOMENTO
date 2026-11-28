import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { cancelMoment, getFeed, getMomentDetail, updateMoment, getMomentForEdit } from "@/server/moments";
import { cancelMembership, inviteUser, myInvitations, requestToJoin, respondToMembership } from "@/server/memberships";
import { blockUser, createReport, resolveReport } from "@/server/safety";
import { getPublicProfile } from "@/server/accounts";
import { zonedLocalToUtc, utcToZonedLocal } from "@/lib/time";
import { localIn, makeMoment, makeUser, resetDb } from "./helpers";

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("fuseaux horaires", () => {
  it("convertit une heure locale Madrid en UTC et inversement (été et hiver)", () => {
    expect(zonedLocalToUtc("2026-07-10T19:00", "Europe/Madrid").toISOString()).toBe("2026-07-10T17:00:00.000Z");
    expect(zonedLocalToUtc("2026-12-10T19:00", "Europe/Madrid").toISOString()).toBe("2026-12-10T18:00:00.000Z");
    expect(utcToZonedLocal(new Date("2026-12-10T18:00:00Z"), "Europe/Madrid")).toBe("2026-12-10T19:00");
  });
});

describe("création et feed", () => {
  it("publie un Moment visible dans le feed, garde le brouillon hors du feed", async () => {
    const host = await makeUser("Hôte");
    await makeMoment(host, { title: "Publié" });
    await makeMoment(host, { title: "Brouillon", publish: false });
    await makeMoment(host, { title: "Invitation", visibility: "INVITE_ONLY" });
    const feed = await getFeed(null, {});
    expect(feed.items.map((m) => m.title)).toEqual(["Publié"]);
  });

  it("refuse une capacité invalide et une fin avant le début", async () => {
    const host = await makeUser();
    await expect(makeMoment(host, { capacity: 0 })).rejects.toThrow();
    await expectCode(makeMoment(host, { startsAtLocal: localIn(2), endsAtLocal: localIn(1) }), "VALIDATION");
  });

  it("refuse de publier un Moment dans le passé", async () => {
    const host = await makeUser();
    await expectCode(makeMoment(host, { startsAtLocal: localIn(-1) }), "VALIDATION");
  });

  it("pagine avec un curseur sans doublon ni trou", async () => {
    const host = await makeUser("Hôte", { premium: true });
    for (let i = 1; i <= 5; i++) await makeMoment(host, { title: `Moment ${i}`, startsAtLocal: localIn(i) });
    const p1 = await getFeed(null, { limit: 2 });
    const p2 = await getFeed(null, { limit: 2, cursor: p1.nextCursor! });
    const p3 = await getFeed(null, { limit: 2, cursor: p2.nextCursor! });
    expect([...p1.items, ...p2.items, ...p3.items].map((m) => m.title)).toEqual(["Moment 1", "Moment 2", "Moment 3", "Moment 4", "Moment 5"]);
    expect(p3.nextCursor).toBeNull();
  });

  it("filtre par ville et catégorie", async () => {
    const host = await makeUser();
    await makeMoment(host, { title: "Aaa", city: "Málaga", category: "dinner" });
    await makeMoment(host, { title: "Bbb", city: "Marbella", category: "dinner" });
    await makeMoment(host, { title: "Ccc", city: "Marbella", category: "coffee" });
    const r = await getFeed(null, { city: "marbella", category: "dinner" });
    expect(r.items.map((m) => m.title)).toEqual(["Bbb"]);
  });
});

describe("demandes, acceptation et capacité", () => {
  it("parcours complet : demande → acceptation → place confirmée → quitter libère la place", async () => {
    const host = await makeUser("Hôte");
    const guest = await makeUser("Invité");
    const id = await makeMoment(host);
    const req = await requestToJoin(guest, id, { message: "Hello" });
    expect(req.status).toBe("PENDING");

    // Le demandeur ne peut pas s'auto-accepter
    await expectCode(respondToMembership(guest, req.id, "accept"), "FORBIDDEN");
    await respondToMembership(host, req.id, "accept");

    const d = await getMomentDetail(guest, id);
    expect(d.acceptedCount).toBe(1);
    expect(d.viewerMembership?.status).toBe("ACCEPTED");
    expect(d.address).toBe("Calle Secreta 1");

    await cancelMembership(guest, req.id);
    expect((await getMomentDetail(guest, id)).acceptedCount).toBe(0);
    const notifs = await prisma.notification.findMany({ where: { userId: host.id } });
    expect(notifs.map((n) => n.type).sort()).toEqual(["JOIN_REQUEST", "MEMBER_LEFT"]);
  });

  it("empêche les doublons de demande", async () => {
    const host = await makeUser();
    const guest = await makeUser();
    const id = await makeMoment(host);
    await requestToJoin(guest, id, {});
    await expectCode(requestToJoin(guest, id, {}), "CONFLICT");
  });

  it("un refus ne permet pas de redemander (pas de relance)", async () => {
    const host = await makeUser();
    const guest = await makeUser();
    const id = await makeMoment(host);
    const r = await requestToJoin(guest, id, {});
    await respondToMembership(host, r.id, "decline");
    await expectCode(requestToJoin(guest, id, {}), "CONFLICT");
  });

  it("ne dépasse jamais la capacité, même avec des acceptations simultanées", async () => {
    const host = await makeUser("Hôte");
    const id = await makeMoment(host, { capacity: 2 });
    const guests = await Promise.all(Array.from({ length: 6 }, () => makeUser("G")));
    const reqs = await Promise.all(guests.map((g) => requestToJoin(g, id, {})));
    const results = await Promise.allSettled(reqs.map((r) => respondToMembership(host, r.id, "accept")));
    const accepted = await prisma.momentMembership.count({ where: { momentId: id, status: "ACCEPTED" } });
    expect(accepted).toBe(2);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(2);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.every((r) => r.reason instanceof AppError && r.reason.code === "MOMENT_FULL")).toBe(true);
  });

  it("mode Ouvert : place immédiate, capacité respectée en simultané", async () => {
    const host = await makeUser();
    const id = await makeMoment(host, { capacity: 3, visibility: "PUBLIC" });
    const guests = await Promise.all(Array.from({ length: 8 }, () => makeUser()));
    await Promise.allSettled(guests.map((g) => requestToJoin(g, id, {})));
    expect(await prisma.momentMembership.count({ where: { momentId: id, status: "ACCEPTED" } })).toBe(3);
  });

  it("l'hôte ne peut pas réduire la capacité sous le nombre de confirmés", async () => {
    const host = await makeUser();
    const id = await makeMoment(host, { capacity: 3, visibility: "PUBLIC" });
    for (let i = 0; i < 2; i++) await requestToJoin(await makeUser(), id, {});
    const form = await getMomentForEdit(host, id);
    await expectCode(updateMoment(host, id, { ...form, capacity: 1, endsAtLocal: null }), "VALIDATION");
  });
});

describe("visibilité et adresse", () => {
  it("masque l'adresse aux non-participants et le Moment sur invitation aux non-invités", async () => {
    const host = await makeUser();
    const stranger = await makeUser();
    const id = await makeMoment(host);
    const d = await getMomentDetail(stranger, id);
    expect(d.address).toBeNull();
    expect(d.addressHidden).toBe(true);
    expect(d.members).toBeNull();

    const inviteOnly = await makeMoment(host, { visibility: "INVITE_ONLY" });
    await expectCode(getMomentDetail(stranger, inviteOnly), "FORBIDDEN");
    await expectCode(requestToJoin(stranger, inviteOnly, {}), "FORBIDDEN");
  });

  it("un brouillon est introuvable pour les autres", async () => {
    const host = await makeUser();
    const id = await makeMoment(host, { publish: false });
    await expectCode(getMomentDetail(await makeUser(), id), "NOT_FOUND");
    await expectCode(getMomentDetail(null, id), "NOT_FOUND");
  });
});

describe("invitations", () => {
  it("invitation par l'hôte, acceptation par l'invité, seul l'invité peut répondre", async () => {
    const host = await makeUser();
    const friend = await makeUser();
    const other = await makeUser();
    const id = await makeMoment(host, { visibility: "INVITE_ONLY" });
    const inv = await inviteUser(host, id, { username: friend.username });
    await expectCode(inviteUser(other, id, { username: host.username }), "FORBIDDEN");
    await expectCode(respondToMembership(host, inv.id, "accept"), "FORBIDDEN");
    await respondToMembership(friend, inv.id, "accept");
    const mine = await myInvitations(friend);
    expect(mine.upcoming).toHaveLength(1);
    expect((await getMomentDetail(friend, id)).address).toBe("Calle Secreta 1");
  });

  it("l'hôte peut retirer une invitation en attente", async () => {
    const host = await makeUser();
    const friend = await makeUser();
    const id = await makeMoment(host);
    const inv = await inviteUser(host, id, { username: friend.username });
    await cancelMembership(host, inv.id);
    await expectCode(respondToMembership(friend, inv.id, "accept"), "CONFLICT");
  });
});

describe("annulation", () => {
  it("annule, prévient participants et demandeurs, bloque les nouvelles demandes", async () => {
    const host = await makeUser();
    const a = await makeUser();
    const b = await makeUser();
    const id = await makeMoment(host, { capacity: 5 });
    const ra = await requestToJoin(a, id, {});
    await respondToMembership(host, ra.id, "accept");
    await requestToJoin(b, id, {});
    await expectCode(cancelMoment(a, id, {}), "FORBIDDEN");
    await cancelMoment(host, id, { reason: "Pluie" });
    const types = await prisma.notification.findMany({ where: { type: "MOMENT_CANCELLED" } });
    expect(types.map((t) => t.userId).sort()).toEqual([a.id, b.id].sort());
    await expectCode(requestToJoin(await makeUser(), id, {}), "MOMENT_NOT_OPEN");
    const detail = await getMomentDetail(a, id);
    expect(detail.phase).toBe("cancelled");
  });
});

describe("sécurité", () => {
  it("le blocage cache les Moments et empêche demandes et invitations", async () => {
    const host = await makeUser();
    const guest = await makeUser();
    const id = await makeMoment(host);
    await blockUser(host, guest.username);
    expect((await getFeed(guest, {})).items).toHaveLength(0);
    await expectCode(getMomentDetail(guest, id), "NOT_FOUND");
    await expectCode(requestToJoin(guest, id, {}), "NOT_FOUND");
    await expectCode(inviteUser(host, id, { username: guest.username }), "BLOCKED");
    await expectCode(getPublicProfile(guest, host.username), "NOT_FOUND");
  });

  it("un compte suspendu ne peut plus agir", async () => {
    const host = await makeUser();
    const sus = await makeUser("S", { status: "SUSPENDED" });
    const id = await makeMoment(host);
    await expectCode(requestToJoin(sus, id, {}), "ACCOUNT_SUSPENDED");
  });

  it("signalement puis suspension par un administrateur uniquement", async () => {
    const reporter = await makeUser();
    const bad = await makeUser();
    const admin = await makeUser("Admin", { role: "ADMIN" });
    const r = await createReport(reporter, { targetUsername: bad.username, reason: "harassment", details: "Messages insistants" });
    await expectCode(resolveReport(reporter, r.id, "suspend_user"), "FORBIDDEN");
    await resolveReport(admin, r.id, "suspend_user", "Confirmé");
    const u = await prisma.user.findUniqueOrThrow({ where: { id: bad.id } });
    expect(u.status).toBe("SUSPENDED");
    expect(await prisma.auditEvent.count()).toBe(1);
  });

  it("le profil public n'expose ni email ni adresse", async () => {
    const host = await makeUser();
    await makeMoment(host);
    const p = await getPublicProfile(null, host.username);
    const json = JSON.stringify(p);
    expect(json).not.toContain("@test.local");
    expect(json).not.toContain("Calle Secreta");
  });
});

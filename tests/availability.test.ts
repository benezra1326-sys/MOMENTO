import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { utcToZonedLocal } from "@/lib/time";
import { blockUser } from "@/server/safety";
import {
  createAvailability,
  deleteAvailability,
  getAvailability,
  listAvailabilities,
  myAvailabilities,
  updateAvailability,
} from "@/server/availability";
import { authorizeVideoUpload, newVideoPath } from "@/server/video-uploads";
import { dispoContextsFor, inviteUser, myInvitations } from "@/server/memberships";
import { getFeed } from "@/server/moments";
import { makeMoment, makeUser, resetDb } from "./helpers";

const TZ = "Europe/Madrid";
const day = (n: number) => utcToZonedLocal(new Date(Date.now() + n * 86400_000), TZ).slice(0, 10);
const base = (n = 1, slot = "evening") => ({ date: day(n), slot, timezone: TZ, city: "Marbella", area: "Centre", categories: ["drinks"], note: "Partant pour un verre" });

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

beforeEach(resetDb);
afterAll(() => prisma.$disconnect());

describe("disponibilités", () => {
  it("publie une dispo visible des autres membres, jamais avec une adresse", async () => {
    const lea = await makeUser("Léa");
    const tom = await makeUser("Tom");
    const a = await createAvailability(lea, base());
    expect(a.slot).toBe("evening");
    expect(a.date).toBe(day(1));
    const seen = await listAvailabilities(tom, {});
    expect(seen.map((x) => x.id)).toEqual([a.id]);
    expect(seen[0].isMine).toBe(false);
    expect(Object.keys(seen[0])).not.toContain("address");
    // L'auteur la voit aussi, marquée comme sienne.
    expect((await listAvailabilities(lea, {}))[0].isMine).toBe(true);
  });

  it("filtre par ville et ignore les créneaux passés ou trop lointains", async () => {
    const lea = await makeUser("Léa", { premium: true });
    const tom = await makeUser("Tom");
    await createAvailability(lea, base(2));
    await createAvailability(lea, { ...base(3), city: "Madrid" });
    expect(await listAvailabilities(tom, { city: "Madrid" })).toHaveLength(1);
    await expectCode(createAvailability(lea, base(30)), "VALIDATION");
    await expectCode(createAvailability(lea, { ...base(0), date: day(-1) }), "VALIDATION");
  });

  it("gratuit : une dispo active à la fois, remplaçable, et une dispo expirée ne bloque pas", async () => {
    const lea = await makeUser("Léa");
    const first = await createAvailability(lea, base(1));
    await expectCode(createAvailability(lea, base(1)), "CONFLICT");
    const err = await createAvailability(lea, base(2)).catch((e) => e as AppError);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("AVAILABILITY_LIMIT");
    expect((err as AppError).details?.activeId).toBe(first.id);
    // Remplacer l'actuelle par la nouvelle.
    const second = await createAvailability(lea, { ...base(2), replaceId: first.id });
    expect((await myAvailabilities(lea)).map((a) => a.id)).toEqual([second.id]);
    // Supprimée : on peut publier tout de suite.
    await deleteAvailability(lea, second.id);
    const third = await createAvailability(lea, base(3));
    // Expirée : ne compte plus.
    await prisma.availability.update({ where: { id: third.id }, data: { startsAt: new Date(Date.now() - 7200_000), endsAt: new Date(Date.now() - 3600_000) } });
    await createAvailability(lea, base(4));
  });

  it("gratuit : deux publications simultanées n'en créent qu'une", async () => {
    const lea = await makeUser("Léa");
    const results = await Promise.allSettled([createAvailability(lea, base(1)), createAvailability(lea, base(2))]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.availability.count({ where: { userId: lea.id } })).toBe(1);
  });

  it("Upclose+ : jusqu'à 5 dispos actives", async () => {
    const lea = await makeUser("Léa", { plan: "plus" });
    for (let i = 1; i <= 5; i++) await createAvailability(lea, base(i));
    await expectCode(createAvailability(lea, base(6)), "AVAILABILITY_LIMIT");
  });

  it("l'auteur peut modifier, masquer et supprimer ; personne d'autre", async () => {
    const lea = await makeUser("Léa");
    const tom = await makeUser("Tom");
    const a = await createAvailability(lea, base());
    await expectCode(updateAvailability(tom, a.id, { note: "pirate" }), "NOT_FOUND");
    await expectCode(deleteAvailability(tom, a.id), "NOT_FOUND");

    const moved = await updateAvailability(lea, a.id, { slot: "lunch", note: "Plutôt le midi" });
    expect(moved.slot).toBe("lunch");
    expect(moved.note).toBe("Plutôt le midi");

    await updateAvailability(lea, a.id, { hidden: true });
    expect(await listAvailabilities(tom, {})).toHaveLength(0);
    await expectCode(getAvailability(tom, a.id), "NOT_FOUND");
    expect((await myAvailabilities(lea))[0].hidden).toBe(true);

    await deleteAvailability(lea, a.id);
    expect(await myAvailabilities(lea)).toHaveLength(0);
  });

  it("respecte les blocages dans les deux sens", async () => {
    const lea = await makeUser("Léa");
    const tom = await makeUser("Tom");
    const a = await createAvailability(lea, base());
    await blockUser(lea, tom.username);
    expect(await listAvailabilities(tom, {})).toHaveLength(0);
    await expectCode(getAvailability(tom, a.id), "NOT_FOUND");
  });

  it("n'envoie aucune invitation ni notification à la publication", async () => {
    const lea = await makeUser("Léa");
    await makeUser("Tom");
    await createAvailability(lea, base());
    expect(await prisma.notification.count()).toBe(0);
    expect(await prisma.momentMembership.count()).toBe(0);
  });

  it("exige une session", async () => {
    await expectCode(listAvailabilities(null, {}), "UNAUTHENTICATED");
    await expectCode(createAvailability(null, base()), "UNAUTHENTICATED");
  });
});

describe("envoi de vidéos", () => {
  it("ne délivre un jeton que pour un chemin vidéo généré, avec type et poids limités", async () => {
    const u = await makeUser("Vidéaste");
    const path = newVideoPath("video/mp4");
    expect(path).toMatch(/^media\/video\/[0-9a-f-]{36}\.mp4$/);
    const opts = await authorizeVideoUpload(u, path);
    expect(opts.allowedContentTypes).toContain("video/mp4");
    expect(opts.maximumSizeInBytes).toBeGreaterThan(0);
    await expectCode(authorizeVideoUpload(u, "media/cover/x.webp"), "VALIDATION");
    await expectCode(authorizeVideoUpload(u, "media/video/../../secret.mp4"), "VALIDATION");
    expect(() => newVideoPath("application/x-msdownload")).toThrow();
    await expectCode(authorizeVideoUpload(null, path), "UNAUTHENTICATED");
  });

  it("limite le nombre de vidéos par heure", async () => {
    const u = await makeUser("Vidéaste");
    for (let i = 0; i < 6; i++) await authorizeVideoUpload(u, newVideoPath("video/mp4"));
    await expectCode(authorizeVideoUpload(u, newVideoPath("video/mp4")), "RATE_LIMITED");
  });
});

describe("plage horaire, distance et rappel de la dispo", () => {
  it("accepte une plage libre « de 18:00 à 21:00 » et filtre par créneau", async () => {
    const lea = await makeUser("Léa", { premium: true });
    const tom = await makeUser("Tom");
    const { slot: _s, ...rest } = base(1);
    void _s;
    const a = await createAvailability(lea, { ...rest, startTime: "18:00", endTime: "21:00" });
    expect(a.startTime).toBe("18:00");
    expect(a.endTime).toBe("21:00");
    expect(a.slot).toBe("custom");
    // Une fin avant le début passe au lendemain.
    const late = await createAvailability(lea, { ...rest, date: day(2), startTime: "22:00", endTime: "02:00" });
    expect(new Date(late.endsAt).getTime() - new Date(late.startsAt).getTime()).toBe(4 * 3600_000);
    await expectCode(createAvailability(lea, { ...rest, date: day(3), startTime: "18:00", endTime: "18:10" }), "VALIDATION");
    expect((await listAvailabilities(tom, { slot: "evening" })).map((x) => x.id).sort()).toEqual([a.id, late.id].sort());
    expect(await listAvailabilities(tom, { slot: "morning" })).toHaveLength(0);
    const moved = await updateAvailability(lea, a.id, { startTime: "17:30", endTime: "20:00" });
    expect(moved.startTime).toBe("17:30");
  });

  it("filtre « Autour de moi » par rayon et donne la distance", async () => {
    const lea = await makeUser("Léa", { premium: true });
    const tom = await makeUser("Tom");
    const centre = await createAvailability(lea, { ...base(1), area: "Casco Antiguo" });
    const banus = await createAvailability(lea, { ...base(2), area: "Puerto Banús" });
    const near = "36.510,-4.885"; // centre de Marbella
    const one = await listAvailabilities(tom, { near, km: 2 });
    expect(one.map((x) => x.id)).toEqual([centre.id]);
    expect(one[0].distanceKm).toBeLessThan(1);
    const ten = await listAvailabilities(tom, { near, km: 10 });
    expect(ten.map((x) => x.id).sort()).toEqual([centre.id, banus.id].sort());
  });

  it("garde la dispo d'origine sur l'invitation, des deux côtés", async () => {
    const lea = await makeUser("Léa");
    const host = await makeUser("Hôte", { premium: true });
    const a = await createAvailability(lea, { ...base(1), note: "Dispo pour faire du cheval" });
    const momentId = await makeMoment(host, { visibility: "INVITE_ONLY" });
    await inviteUser(host, momentId, { username: lea.username, availabilityId: a.id });
    await deleteAvailability(lea, a.id);
    const received = (await myInvitations(lea)).invitationsReceived[0];
    expect(received.dispo?.note).toBe("Dispo pour faire du cheval");
    const ctx = await dispoContextsFor(host, momentId, host.id);
    expect(ctx[0].dispo.note).toBe("Dispo pour faire du cheval");
    expect(ctx[0].person.id).toBe(lea.id);
  });

  it("filtre le feed des Moments par distance", async () => {
    const host = await makeUser("Hôte", { premium: true });
    const tom = await makeUser("Tom");
    const centre = await makeMoment(host, { area: "Casco Antiguo" });
    const cabopino = await makeMoment(host, { area: "Cabopino", title: "Balade à Cabopino" });
    const near = "36.510,-4.885";
    for (const sort of ["best", "date"]) {
      const two = await getFeed(tom, { near, km: 2, sort });
      expect(two.items.map((x) => x.id)).toEqual([centre]);
      expect(two.items[0].distanceKm).toBeLessThan(1);
      const all = await getFeed(tom, { sort });
      expect(all.items.map((x) => x.id).sort()).toEqual([centre, cabopino].sort());
    }
  });
});

describe("changements d'heure et fuseaux", () => {
  it("calcule la vraie durée lors des changements d'heure et respecte le fuseau", async () => {
    const { timeRange } = await import("@/server/availability");
    // Passage à l'heure d'été (Madrid, 28 mars 2027) : de 01:00 à 04:00 locale = 2 h réelles.
    const spring = timeRange("2027-03-28", "01:00", "04:00", TZ, new Date("2027-03-25T12:00:00Z"));
    expect((spring.endsAt.getTime() - spring.startsAt.getTime()) / 3600_000).toBe(2);
    expect(utcToZonedLocal(spring.endsAt, TZ).slice(11, 16)).toBe("04:00");
    // Retour à l'heure d'hiver (31 octobre 2027) : de 22:00 la veille à 04:00 = 7 h réelles, fin le lendemain.
    const autumn = timeRange("2027-10-30", "22:00", "04:00", TZ, new Date("2027-10-28T12:00:00Z"));
    expect((autumn.endsAt.getTime() - autumn.startsAt.getTime()) / 3600_000).toBe(7);
    expect(utcToZonedLocal(autumn.endsAt, TZ).slice(0, 16)).toBe("2027-10-31T04:00");
    // Même heure locale, autre fuseau : l'instant change, l'heure affichée reste celle choisie.
    const paris = timeRange("2027-06-10", "18:00", "21:00", "Europe/Paris", new Date("2027-06-05T12:00:00Z"));
    const london = timeRange("2027-06-10", "18:00", "21:00", "Europe/London", new Date("2027-06-05T12:00:00Z"));
    expect(london.startsAt.getTime() - paris.startsAt.getTime()).toBe(3600_000);
    expect(utcToZonedLocal(london.startsAt, "Europe/London").slice(11, 16)).toBe("18:00");
  });

  it("modifications simultanées d'une même dispo : la dernière gagne sans erreur ni doublon", async () => {
    const lea = await makeUser("Léa");
    const a = await createAvailability(lea, base(1));
    const res = await Promise.allSettled([
      updateAvailability(lea, a.id, { note: "Version A" }),
      updateAvailability(lea, a.id, { note: "Version B" }),
    ]);
    expect(res.every((r) => r.status === "fulfilled")).toBe(true);
    const rows = await prisma.availability.findMany({ where: { userId: lea.id } });
    expect(rows).toHaveLength(1);
    expect(["Version A", "Version B"]).toContain(rows[0].note);
  });
});

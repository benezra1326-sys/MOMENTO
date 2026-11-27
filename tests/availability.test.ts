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
import { makeUser, resetDb } from "./helpers";

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
    const lea = await makeUser("Léa");
    const tom = await makeUser("Tom");
    await createAvailability(lea, base(2));
    await createAvailability(lea, { ...base(3), city: "Madrid" });
    expect(await listAvailabilities(tom, { city: "Madrid" })).toHaveLength(1);
    await expectCode(createAvailability(lea, base(30)), "VALIDATION");
    await expectCode(createAvailability(lea, { ...base(0), date: day(-1) }), "VALIDATION");
  });

  it("limite les dispos actives et refuse les doublons", async () => {
    const lea = await makeUser("Léa");
    await createAvailability(lea, base(1));
    await expectCode(createAvailability(lea, base(1)), "CONFLICT");
    await createAvailability(lea, base(2));
    await createAvailability(lea, base(3));
    await expectCode(createAvailability(lea, base(4)), "RATE_LIMITED");
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

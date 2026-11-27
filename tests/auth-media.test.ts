import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Les fonctions de session lisent les cookies de la requête : on simule une boîte à cookies en mémoire.
const jar = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  }),
  headers: async () => new Headers({ host: "localhost:3000" }),
}));

import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireVerified } from "@/lib/auth";
import { deleteMyAccount, signup } from "@/server/accounts";
import { confirmEmail, requestPasswordReset, resetPassword } from "@/server/auth-tokens";
import { outbox } from "@/server/email";
import { upsertGoogleUser } from "@/server/google";
import { upsertFacebookUser } from "@/server/facebook";
import { normalizePhone, phoneOutbox, startPhoneLogin, verifyPhoneLogin } from "@/server/phone";
import { getMomentDetail } from "@/server/moments";
import { inviteUser, requestToJoin, respondToMembership } from "@/server/memberships";
import { blockUser } from "@/server/safety";
import { uploadImage } from "@/server/uploads";
import { isAllowedMediaUrl } from "@/lib/media";
import { momentInputSchema } from "@/lib/validation";
import { makeMoment, makeUser, resetDb } from "./helpers";

async function expectCode(p: Promise<unknown>, code: string) {
  await expect(p).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

function tokenFrom(text: string, param = "jeton") {
  const m = text.match(new RegExp(`${param}=([A-Za-z0-9_-]+)`));
  if (!m) throw new Error("jeton introuvable dans l'e-mail");
  return m[1];
}

let seq = 0;
function signupInput(over: Record<string, unknown> = {}) {
  seq++;
  return { name: "Nouvelle", username: `nouvelle${seq}_${Date.now() % 1e5}`, email: `n${seq}-${Date.now()}@test.local`, password: "motdepasse1", acceptAge: true, ...over };
}

beforeEach(async () => {
  await resetDb();
  jar.clear();
  outbox.length = 0;
});
afterEach(() => {
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
});
afterAll(() => prisma.$disconnect());

describe("inscription et vérification d'adresse", () => {
  it("envoie un lien, le confirme une seule fois", async () => {
    const input = signupInput();
    const res = await signup(input);
    expect(res.verificationSent).toBe(true);
    const mail = outbox.at(-1)!;
    expect(mail.to).toBe(input.email);
    const token = tokenFrom(mail.text);
    // Seul le hachage est en base, jamais le jeton.
    const row = await prisma.authToken.findFirstOrThrow({ where: { userId: res.id } });
    expect(row.tokenHash).not.toBe(token);

    expect(await confirmEmail({ token })).toEqual({ verified: true });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: res.id } });
    expect(u.emailVerifiedAt).not.toBeNull();
    await expectCode(confirmEmail({ token }), "VALIDATION");
  });

  it("refuse un jeton expiré ou inconnu", async () => {
    const res = await signup(signupInput());
    const token = tokenFrom(outbox.at(-1)!.text);
    await prisma.authToken.updateMany({ where: { userId: res.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expectCode(confirmEmail({ token }), "VALIDATION");
    await expectCode(confirmEmail({ token: "x".repeat(43) }), "VALIDATION");
  });

  it("refuse un doublon d'e-mail ou de pseudo, y compris en simultané", async () => {
    const input = signupInput();
    await signup(input);
    await expectCode(signup({ ...input, username: "autre_pseudo" }), "CONFLICT");
    const twin = signupInput();
    const results = await Promise.allSettled([signup(twin), signup(twin)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(AppError);
    expect((failed.reason as AppError).code).toBe("CONFLICT");
  });

  it("n'exige l'adresse confirmée que si REQUIRE_EMAIL_VERIFICATION=true", async () => {
    const unverified = await makeUser("Sans", { verified: false });
    expect(requireVerified(unverified).id).toBe(unverified.id);
    process.env.REQUIRE_EMAIL_VERIFICATION = "true";
    expect(() => requireVerified(unverified)).toThrow(AppError);
    await expectCode(makeMoment(unverified), "EMAIL_NOT_VERIFIED");
    const verified = await makeUser("Avec");
    await expect(makeMoment(verified)).resolves.toBeTypeOf("string");
    // Les comptes démo restent utilisables.
    expect(requireVerified({ ...unverified, isDemo: true }).id).toBe(unverified.id);
  });
});

describe("mot de passe oublié", () => {
  it("répond pareil que l'adresse existe ou non, et n'envoie rien pour une adresse inconnue", async () => {
    const u = await makeUser("Reset");
    const known = await requestPasswordReset({ email: (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email });
    const unknown = await requestPasswordReset({ email: "personne@test.local" });
    expect(known).toEqual(unknown);
    expect(outbox).toHaveLength(1);
  });

  it("change le mot de passe, ferme les anciennes sessions, le lien ne sert qu'une fois", async () => {
    const u = await makeUser("Reset");
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email;
    await prisma.session.create({ data: { userId: u.id, id: "ancienne-session", expiresAt: new Date(Date.now() + 86400_000) } });
    await requestPasswordReset({ email });
    const token = tokenFrom(outbox.at(-1)!.text);
    await expect(resetPassword({ token, password: "court" })).rejects.toThrow("8 caractères");
    await resetPassword({ token, password: "nouveau-secret-1" });
    const sessions = await prisma.session.findMany({ where: { userId: u.id } });
    expect(sessions.map((s) => s.id)).not.toContain("ancienne-session");
    expect(sessions).toHaveLength(1);
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.passwordHash).toBeTruthy();
    await expectCode(resetPassword({ token, password: "encore-un-autre" }), "VALIDATION");
  });

  it("un nouveau lien invalide le précédent, et les envois sont limités par heure", async () => {
    const u = await makeUser("Reset");
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email;
    await requestPasswordReset({ email });
    const first = tokenFrom(outbox.at(-1)!.text);
    await requestPasswordReset({ email });
    await expectCode(resetPassword({ token: first, password: "nouveau-secret-1" }), "VALIDATION");
    await requestPasswordReset({ email });
    await requestPasswordReset({ email });
    expect(outbox).toHaveLength(3);
  });

  it("n'envoie rien pour un compte démo ou suspendu", async () => {
    const demo = await prisma.user.create({ data: { email: "demo@test.local", username: "demo_x", name: "Démo", isDemo: true } });
    const susp = await makeUser("Susp", { status: "SUSPENDED" });
    await requestPasswordReset({ email: demo.email });
    await requestPasswordReset({ email: (await prisma.user.findUniqueOrThrow({ where: { id: susp.id } })).email });
    expect(outbox).toHaveLength(0);
  });
});

describe("connexion Google", () => {
  it("refuse une adresse Google non vérifiée", async () => {
    await expectCode(upsertGoogleUser({ sub: "g1", email: "a@test.local", email_verified: false }), "UNAUTHENTICATED");
  });

  it("relie un compte e-mail existant et confirme son adresse", async () => {
    const u = await makeUser("Lien", { verified: false });
    const email = (await prisma.user.findUniqueOrThrow({ where: { id: u.id } })).email!;
    const res = await upsertGoogleUser({ sub: "g2", email, email_verified: true });
    expect(res).toEqual({ id: u.id, isNew: false });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.googleId).toBe("g2");
    expect(after.emailVerifiedAt).not.toBeNull();
  });

  it("ne relie jamais un compte démo", async () => {
    await prisma.user.create({ data: { email: "demo2@test.local", username: "demo_y", name: "Démo", isDemo: true } });
    await expectCode(upsertGoogleUser({ sub: "g3", email: "demo2@test.local", email_verified: true }), "CONFLICT");
  });

  it("deux connexions simultanées créent un seul compte", async () => {
    const p = { sub: "g4", email: "double@test.local", email_verified: true, name: "Double" };
    const [a, b] = await Promise.all([upsertGoogleUser(p), upsertGoogleUser(p)]);
    expect(a.id).toBe(b.id);
    expect(await prisma.user.count({ where: { googleId: "g4" } })).toBe(1);
  });
});

describe("connexion Facebook", () => {
  it("refuse un compte Facebook sans adresse e-mail", async () => {
    await expectCode(upsertFacebookUser({ id: "f1", name: "Sans Mail" }), "UNAUTHENTICATED");
  });

  it("crée un compte confirmé à la première connexion, puis le retrouve", async () => {
    const first = await upsertFacebookUser({ id: "f2", email: "Fb@Test.local", name: "Fanny Book" });
    expect(first.isNew).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: first.id } });
    expect(u.email).toBe("fb@test.local");
    expect(u.facebookId).toBe("f2");
    expect(u.emailVerifiedAt).not.toBeNull();
    expect(await upsertFacebookUser({ id: "f2", email: "fb@test.local" })).toEqual({ id: first.id, isNew: false });
  });

  it("relie un compte existant, y compris un compte déjà relié à Google", async () => {
    const g = await upsertGoogleUser({ sub: "g9", email: "deux@test.local", email_verified: true, name: "Deux" });
    const f = await upsertFacebookUser({ id: "f3", email: "deux@test.local" });
    expect(f).toEqual({ id: g.id, isNew: false });
    const u = await prisma.user.findUniqueOrThrow({ where: { id: g.id } });
    expect(u.googleId).toBe("g9");
    expect(u.facebookId).toBe("f3");
  });

  it("ne relie jamais un compte démo", async () => {
    await prisma.user.create({ data: { email: "demo3@test.local", username: "demo_z", name: "Démo", isDemo: true } });
    await expectCode(upsertFacebookUser({ id: "f4", email: "demo3@test.local" }), "CONFLICT");
  });

  it("refuse une adresse déjà reliée à un autre compte Facebook", async () => {
    await upsertFacebookUser({ id: "f5", email: "pris@test.local" });
    await expectCode(upsertFacebookUser({ id: "f6", email: "pris@test.local" }), "CONFLICT");
  });
});

describe("connexion par téléphone", () => {
  it("met les numéros au format international", () => {
    expect(normalizePhone("06 12 34 56 78")).toBe("+33612345678");
    expect(normalizePhone("0034 612 345 678")).toBe("+34612345678");
    expect(normalizePhone("+972-54-123-4567")).toBe("+972541234567");
    expect(() => normalizePhone("12345")).toThrow(AppError);
  });

  it("crée un compte sans e-mail au premier code, puis le retrouve", async () => {
    const { phone } = await startPhoneLogin({ phone: "06 11 22 33 44" });
    await expectCode(verifyPhoneLogin({ phone, code: "000000" === phoneOutbox.get(phone) ? "111111" : "000000" }), "UNAUTHENTICATED");
    await startPhoneLogin({ phone });
    const first = await verifyPhoneLogin({ phone, code: phoneOutbox.get(phone)! });
    expect(first.isNew).toBe(true);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: first.id } });
    expect(u.email).toBeNull();
    expect(u.phone).toBe("+33611223344");
    expect(u.phoneVerifiedAt).not.toBeNull();
    await startPhoneLogin({ phone });
    expect(await verifyPhoneLogin({ phone, code: phoneOutbox.get(phone)! })).toEqual({ id: first.id, isNew: false });
  });

  it("un code ne sert qu'une fois", async () => {
    const { phone } = await startPhoneLogin({ phone: "+33699887766" });
    const code = phoneOutbox.get(phone)!;
    await verifyPhoneLogin({ phone, code });
    await expectCode(verifyPhoneLogin({ phone, code }), "UNAUTHENTICATED");
  });

  it("refuse un compte suspendu", async () => {
    const u = await makeUser("Susp", { status: "SUSPENDED" });
    await prisma.user.update({ where: { id: u.id }, data: { phone: "+33600000001" } });
    const { phone } = await startPhoneLogin({ phone: "+33600000001" });
    await expectCode(verifyPhoneLogin({ phone, code: phoneOutbox.get(phone)! }), "ACCOUNT_SUSPENDED");
  });
});

describe("matrice d'accès à un Moment", () => {
  async function scenario(visibility: "INVITE_ONLY" | "PRIVATE" | "REQUEST", publish = true) {
    const host = await makeUser("Hôte");
    const id = await makeMoment(host, { visibility, publish, capacity: 5 });
    return { host, id };
  }

  it("brouillon : seul l'hôte le voit", async () => {
    const { host, id } = await scenario("REQUEST", false);
    const stranger = await makeUser("Inconnu");
    await expect(getMomentDetail(host, id)).resolves.toBeTruthy();
    await expectCode(getMomentDetail(null, id), "NOT_FOUND");
    await expectCode(getMomentDetail(stranger, id), "NOT_FOUND");
  });

  it("sur invitation : refusé aux inconnus, ouvert à l'invité ; adresse réservée aux acceptés", async () => {
    const { host, id } = await scenario("INVITE_ONLY");
    const stranger = await makeUser("Inconnu");
    const guest = await makeUser("Invité");
    await expectCode(getMomentDetail(null, id), "FORBIDDEN");
    await expectCode(getMomentDetail(stranger, id), "FORBIDDEN");
    await inviteUser(host, id, { username: guest.username });
    const invited = await getMomentDetail(guest, id);
    expect(invited.address).toBeNull();
    expect(invited.addressHidden).toBe(true);
    const inv = await prisma.momentMembership.findFirstOrThrow({ where: { momentId: id, userId: guest.id } });
    await respondToMembership(guest, inv.id, "accept");
    expect((await getMomentDetail(guest, id)).address).toBe("Calle Secreta 1");
    expect((await getMomentDetail(host, id)).address).toBe("Calle Secreta 1");
  });

  it("privé : visible par lien, adresse cachée jusqu'à acceptation", async () => {
    const { host, id } = await scenario("PRIVATE");
    const anon = await getMomentDetail(null, id);
    expect(anon.address).toBeNull();
    const asker = await makeUser("Demandeur");
    await requestToJoin(asker, id, {});
    expect((await getMomentDetail(asker, id)).address).toBeNull();
    const req = await prisma.momentMembership.findFirstOrThrow({ where: { momentId: id, userId: asker.id } });
    await respondToMembership(host, req.id, "accept");
    expect((await getMomentDetail(asker, id)).address).toBe("Calle Secreta 1");
  });

  it("blocage : le Moment disparaît dans les deux sens", async () => {
    const { host, id } = await scenario("REQUEST");
    const a = await makeUser("Bloqué");
    const b = await makeUser("Bloqueur");
    await blockUser(host, a.username);
    await blockUser(b, host.username);
    await expectCode(getMomentDetail(a, id), "NOT_FOUND");
    await expectCode(getMomentDetail(b, id), "NOT_FOUND");
    await expectCode(requestToJoin(a, id, {}), "NOT_FOUND");
  });
});

describe("médias", () => {
  it("n'accepte que nos propres URLs", () => {
    expect(isAllowedMediaUrl("/demo/sunset.jpg")).toBe(true);
    expect(isAllowedMediaUrl("/demo/../secret")).toBe(false);
    expect(isAllowedMediaUrl("/uploads/cover/0b6f0e3a-1a2b-4c3d-8e9f-001122334455.webp")).toBe(true);
    expect(isAllowedMediaUrl("https://abc123.public.blob.vercel-storage.com/media/cover/x.webp")).toBe(true);
    expect(isAllowedMediaUrl("https://abc123.public.blob.vercel-storage.com/autre/x.webp")).toBe(false);
    expect(isAllowedMediaUrl("http://abc123.public.blob.vercel-storage.com/media/x.webp")).toBe(false);
    expect(isAllowedMediaUrl("https://evil.example.com/media/x.webp")).toBe(false);
    expect(isAllowedMediaUrl("https://evil.com?.public.blob.vercel-storage.com/media/x")).toBe(false);
  });

  it("refuse une vidéo qui ne vient pas des visuels démo", () => {
    const base = { title: "Vidéo test", description: "Une description assez longue.", category: "sunset", city: "Paris", startsAtLocal: "2030-01-01T10:00", timezone: "Europe/Paris" };
    const bad = momentInputSchema.safeParse({ ...base, mediaType: "VIDEO", mediaUrl: "https://abc.public.blob.vercel-storage.com/media/cover/x.webp" });
    expect(bad.success).toBe(false);
    const ext = momentInputSchema.safeParse({ ...base, mediaType: "IMAGE", mediaUrl: "https://images.example.com/a.jpg" });
    expect(ext.success).toBe(false);
  });

  describe("envoi d'image (stockage local)", () => {
    beforeEach(() => void (process.env.STORAGE_DRIVER = "local"));
    afterEach(async () => {
      delete process.env.STORAGE_DRIVER;
      for (const p of ["cover", "avatar"]) await rm(path.join(process.cwd(), "public", "uploads", p), { recursive: true, force: true });
    });

    async function png(w: number, h: number) {
      const buf = await sharp({ create: { width: w, height: h, channels: 3, background: "#d93d74" } }).png().toBuffer();
      return new File([new Uint8Array(buf)], "photo.png", { type: "image/png" });
    }

    it("ré-encode en WebP, enregistre l'envoi et respecte les refus", async () => {
      const u = await makeUser("Photo");
      await expectCode(uploadImage(u, new File(["x"], "a.gif", { type: "image/gif" }), "cover"), "VALIDATION");
      await expectCode(uploadImage(u, await png(100, 100), "cover"), "VALIDATION");
      await expectCode(uploadImage(u, new File(["pas une image"], "a.png", { type: "image/png" }), "cover"), "VALIDATION");
      const res = await uploadImage(u, await png(800, 600), "avatar");
      expect(res.url).toMatch(/^\/uploads\/avatar\/[0-9a-f-]+\.webp$/);
      expect(isAllowedMediaUrl(res.url)).toBe(true);
      const meta = await sharp(path.join(process.cwd(), "public", res.url)).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.exif).toBeUndefined();
      expect(await prisma.upload.count({ where: { userId: u.id } })).toBe(1);
    });

    it("limite le nombre d'envois par heure", async () => {
      const u = await makeUser("Quota");
      await prisma.upload.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ userId: u.id, url: `/uploads/cover/${i}.webp`, purpose: "cover", bytes: 1 })) });
      await expectCode(uploadImage(u, await png(400, 400), "cover"), "RATE_LIMITED");
    });

    it("refuse proprement quand aucun stockage n'est configuré", async () => {
      process.env.STORAGE_DRIVER = "none";
      const u = await makeUser("Sans");
      await expectCode(uploadImage(u, await png(400, 400), "cover"), "INTERNAL");
    });
  });
});

describe("suppression de compte", () => {
  it("anonymise le compte, annule ses Moments à venir et ferme ses sessions", async () => {
    const host = await makeUser("Partant");
    const id = await makeMoment(host);
    const guest = await makeUser("Invité");
    await requestToJoin(guest, id, {});
    await prisma.session.create({ data: { userId: host.id, id: "s-host", expiresAt: new Date(Date.now() + 86400_000) } });
    await expectCode(deleteMyAccount(host, "mauvais"), "VALIDATION");
    await deleteMyAccount(host, host.username);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: host.id } });
    expect(u.status).toBe("DELETED");
    expect(u.email).toMatch(/@momento\.invalid$/);
    expect(u.passwordHash).toBeNull();
    expect(await prisma.session.count({ where: { userId: host.id } })).toBe(0);
    expect((await prisma.moment.findUniqueOrThrow({ where: { id } })).status).toBe("CANCELLED");
    expect(await prisma.notification.count({ where: { userId: guest.id, type: "MOMENT_CANCELLED" } })).toBe(1);
  });
});

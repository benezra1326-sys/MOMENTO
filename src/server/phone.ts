/**
 * Connexion par numéro de téléphone : code à 6 chiffres envoyé par SMS via Twilio Verify.
 * S'active quand TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_VERIFY_SERVICE_SID sont définis.
 * Twilio génère le code, limite les tentatives et bloque les envois frauduleux.
 * Sans Twilio, en développement et en test, le code est écrit dans la console (phoneOutbox).
 * Voir docs/PHONE_SIGN_IN.md.
 */
import { randomInt } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError, isUniqueViolation } from "@/lib/errors";

type Provider = "twilio" | "console" | "none";

export function phoneProvider(): Provider {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_VERIFY_SERVICE_SID) return "twilio";
  return process.env.NODE_ENV === "production" ? "none" : "console";
}

export function phoneEnabled() {
  return phoneProvider() !== "none";
}

/**
 * Met un numéro au format international E.164.
 * « 06 12 34 56 78 » est compris comme un numéro français ; sinon il faut l'indicatif (+34…, +972…).
 */
export function normalizePhone(raw: string): string {
  let s = raw.trim().replace(/[\s.\-()]/g, "");
  if (s.startsWith("00")) s = `+${s.slice(2)}`;
  if (/^0[1-9]\d{8}$/.test(s)) s = `+33${s.slice(1)}`;
  if (!/^\+[1-9]\d{7,14}$/.test(s)) {
    throw new AppError("VALIDATION", "Numéro invalide. Indique-le avec l'indicatif du pays, par exemple +33 6 12 34 56 78.");
  }
  return s;
}

/** Pour les tests et le développement : derniers codes « envoyés ». */
export const phoneOutbox = new Map<string, string>();

function twilioAuth() {
  return `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`;
}

async function twilio(path: string, form: Record<string, string>) {
  const res = await fetch(`https://verify.twilio.com/v2/Services/${process.env.TWILIO_VERIFY_SERVICE_SID}/${path}`, {
    method: "POST",
    headers: { Authorization: twilioAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
  return { ok: res.ok, status: res.status, body };
}

const startSchema = z.object({ phone: z.string().max(40), locale: z.string().max(10).optional() });

/** Envoie un code par SMS. Réponse identique que le numéro ait un compte ou non. */
export async function startPhoneLogin(raw: unknown) {
  const { phone: rawPhone, locale } = startSchema.parse(raw);
  const phone = normalizePhone(rawPhone);
  const provider = phoneProvider();
  if (provider === "none") throw new AppError("FORBIDDEN", "La connexion par téléphone n'est pas encore activée.");
  if (provider === "console") {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    phoneOutbox.set(phone, code);
    if (process.env.NODE_ENV !== "test") console.info(`[sms] Code pour ${phone.slice(0, 4)}… : ${code}`);
    return { phone, sent: true };
  }
  const r = await twilio("Verifications", { To: phone, Channel: "sms", ...(locale === "en" || locale === "fr" ? { Locale: locale } : {}) });
  if (!r.ok) {
    console.error("[sms] envoi en échec", r.status, r.body.code, r.body.message?.replace(/\+\d+/g, "<numéro>"));
    if (r.status === 429 || r.body.code === 60203) throw new AppError("RATE_LIMITED", "Trop de codes demandés. Réessaie dans quelques minutes.");
    if (r.body.code === 60200 || r.body.code === 21614 || r.body.code === 60205) throw new AppError("VALIDATION", "Ce numéro ne peut pas recevoir de SMS.");
    if (r.body.code === 60410 || r.body.code === 60605) throw new AppError("VALIDATION", "Les SMS vers ce pays ne sont pas encore ouverts.");
    throw new AppError("INTERNAL", "L'envoi du SMS a échoué. Réessaie.");
  }
  return { phone, sent: true };
}

const verifySchema = z.object({ phone: z.string().max(40), code: z.string().trim().regex(/^\d{4,8}$/, "Le code contient 6 chiffres.") });

async function checkCode(phone: string, code: string): Promise<boolean> {
  if (phoneProvider() === "console") {
    const ok = phoneOutbox.get(phone) === code;
    if (ok) phoneOutbox.delete(phone);
    return ok;
  }
  const r = await twilio("VerificationCheck", { To: phone, Code: code });
  if (r.status === 404) return false; // code expiré, déjà utilisé ou trop de tentatives
  if (r.status === 429) throw new AppError("RATE_LIMITED", "Trop d'essais. Demande un nouveau code.");
  if (!r.ok) throw new AppError("INTERNAL", "La vérification du code a échoué. Réessaie.");
  return r.body.status === "approved";
}

/** Vérifie le code puis trouve ou crée le compte lié à ce numéro. */
export async function verifyPhoneLogin(raw: unknown): Promise<{ id: string; isNew: boolean }> {
  const input = verifySchema.parse(raw);
  const phone = normalizePhone(input.phone);
  if (phoneProvider() === "none") throw new AppError("FORBIDDEN", "La connexion par téléphone n'est pas encore activée.");
  if (!(await checkCode(phone, input.code))) {
    throw new AppError("UNAUTHENTICATED", "Code incorrect ou expiré. Vérifie-le ou demande un nouveau code.");
  }
  return upsertPhoneUser(phone);
}

export async function upsertPhoneUser(phone: string): Promise<{ id: string; isNew: boolean }> {
  const existing = await prisma.user.findUnique({ where: { phone } });
  if (existing) {
    if (existing.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
    if (existing.status === "DELETED") throw new AppError("UNAUTHENTICATED", "Ce compte a été supprimé.");
    if (!existing.phoneVerifiedAt) await prisma.user.update({ where: { id: existing.id }, data: { phoneVerifiedAt: new Date() } });
    return { id: existing.id, isNew: false };
  }
  // Nouveau compte : le nom et le pseudo se choisissent ensuite dans le profil.
  const create = (username: string) =>
    prisma.user.create({ data: { phone, phoneVerifiedAt: new Date(), name: "Membre", username } });
  try {
    const user = await create(`membre${randomInt(100000, 999999)}`);
    return { id: user.id, isNew: true };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const again = await prisma.user.findUnique({ where: { phone } });
    if (again) return { id: again.id, isNew: false };
    const user = await create(`membre${Date.now().toString(36)}`);
    return { id: user.id, isNew: true };
  }
}

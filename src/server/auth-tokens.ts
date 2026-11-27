import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { AuthTokenKind } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createSession, destroyAllSessions, hashSecret, requireActive, type Viewer } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { productConfig } from "@/config/product";
import { actionEmail, publicBaseUrl, sendEmail } from "./email";
import { getLocale, getT } from "@/lib/i18n/server";

/**
 * Jetons envoyés par e-mail : vérification d'adresse (24 h) et mot de passe oublié (1 h).
 * - Jeton aléatoire de 32 octets ; seul son hachage sha256 est stocké.
 * - Usage unique ; un nouveau jeton invalide les précédents du même type.
 * - Limite d'envoi par compte et par heure.
 * - « Mot de passe oublié » répond toujours la même chose, que l'adresse existe ou non.
 */
const TTL_MS: Record<AuthTokenKind, number> = {
  VERIFY_EMAIL: 24 * 3600_000,
  RESET_PASSWORD: 3600_000,
};

const GENERIC_RESET_MESSAGE = "Si un compte existe avec cette adresse, un lien de réinitialisation vient d'être envoyé.";

async function issueToken(userId: string, kind: AuthTokenKind): Promise<string | null> {
  const recent = await prisma.authToken.count({
    where: { userId, kind, createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= productConfig.limits.authEmailsPerHour) return null;
  const token = randomBytes(32).toString("base64url");
  await prisma.$transaction([
    prisma.authToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.authToken.create({
      data: { userId, kind, tokenHash: hashSecret(token), expiresAt: new Date(Date.now() + TTL_MS[kind]) },
    }),
  ]);
  return token;
}

/** Consomme un jeton valide (non expiré, non utilisé) de façon atomique. */
async function consumeToken(token: string, kind: AuthTokenKind) {
  const invalid = new AppError(
    "VALIDATION",
    kind === "VERIFY_EMAIL" ? "Ce lien de confirmation n'est plus valide. Demande-en un nouveau." : "Ce lien a expiré ou a déjà servi. Refais une demande.",
  );
  if (!token || token.length < 20 || token.length > 100) throw invalid;
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashSecret(token) }, include: { user: true } });
  if (!row || row.kind !== kind || row.usedAt || row.expiresAt < new Date()) throw invalid;
  const claimed = await prisma.authToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) throw invalid;
  if (row.user.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Ce compte n'est pas disponible.");
  return row.user;
}

/** Envoie (ou renvoie) le lien de confirmation d'adresse à l'utilisateur connecté. */
export async function sendVerificationEmail(userId: string): Promise<{ sent: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.email || user.emailVerifiedAt || user.isDemo || user.status !== "ACTIVE") return { sent: false };
  const token = await issueToken(user.id, "VERIFY_EMAIL");
  if (!token) throw new AppError("RATE_LIMITED", "Trop d'e-mails envoyés. Réessaie dans une heure.");
  const url = `${await publicBaseUrl()}/verifier-email?jeton=${token}`;
  const sent = await sendEmail(
    actionEmail({
      to: user.email!,
      subject: "Confirme ton adresse e-mail",
      greeting: `Bonjour ${user.name},`,
      intro: "Bienvenue sur Upclose ! Confirme ton adresse pour pouvoir créer et rejoindre des Moments.",
      cta: "Confirmer mon adresse",
      url,
      outro: "Ce lien est valable 24 heures. Si tu n'as pas créé de compte, ignore cet e-mail.",
    }),
  );
  return { sent };
}

export async function resendVerification(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  if (viewer.emailVerifiedAt) return { sent: false, alreadyVerified: true };
  return sendVerificationEmail(viewer.id);
}

export async function confirmEmail(raw: unknown) {
  const { token } = z.object({ token: z.string() }).parse(raw);
  const user = await consumeToken(token, "VERIFY_EMAIL");
  if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  return { verified: true };
}

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.") });

export async function requestPasswordReset(raw: unknown) {
  const { email } = forgotSchema.parse(raw);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.email && user.status === "ACTIVE" && !user.isDemo) {
    const token = await issueToken(user.id, "RESET_PASSWORD");
    if (token) {
      const url = `${await publicBaseUrl()}/nouveau-mot-de-passe?jeton=${token}`;
      const t = await getT();
      await sendEmail(
        actionEmail({
          to: user.email,
          subject: t("Réinitialise ton mot de passe"),
          greeting: t("Bonjour {name},", { name: user.name }),
          intro: t("Tu as demandé à changer ton mot de passe Upclose."),
          cta: t("Choisir un nouveau mot de passe"),
          url,
          outro: t("Ce lien est valable 1 heure et ne sert qu'une fois. Si tu n'as rien demandé, ignore cet e-mail : ton mot de passe reste inchangé."),
          fallback: t("Si le bouton ne marche pas, copie ce lien :"),
          lang: await getLocale(),
        }),
      );
    }
  }
  // Réponse identique dans tous les cas : impossible de savoir si une adresse a un compte.
  return { message: GENERIC_RESET_MESSAGE };
}

const resetSchema = z.object({
  token: z.string(),
  password: z.string().min(8, "8 caractères minimum.").max(200),
});

export async function resetPassword(raw: unknown) {
  const { token, password } = resetSchema.parse(raw);
  const user = await consumeToken(token, "RESET_PASSWORD");
  await prisma.user.update({
    where: { id: user.id },
    // Le lien prouve l'accès à la boîte mail : l'adresse est confirmée au passage.
    data: { passwordHash: await hashPassword(password), emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
  });
  await destroyAllSessions(user.id);
  await createSession(user.id);
  return { id: user.id, username: user.username };
}

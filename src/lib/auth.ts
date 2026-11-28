import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./errors";

export const SESSION_COOKIE = "momento_session";
const SESSION_DAYS = 30;

export type Viewer = Pick<User, "id" | "role" | "status" | "name" | "username" | "photoUrl" | "isDemo" | "city" | "emailVerifiedAt" | "phoneVerifiedAt" | "showAdult" | "adultConfirmedAt" | "premiumUntil">;

const viewerSelect = {
  id: true, role: true, status: true, name: true, username: true, photoUrl: true, isDemo: true, city: true, emailVerifiedAt: true, phoneVerifiedAt: true, showAdult: true, adultConfirmedAt: true, premiumUntil: true,
} as const;

export function hashSecret(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

const hashToken = hashSecret;

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Utilisateur connecté, ou null. Un compte supprimé n'a plus de session valide. */
export async function getViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: { select: viewerSelect } },
  });
  if (!session || session.expiresAt < new Date() || session.user.status === "DELETED") return null;
  return session.user;
}

/** Variante tolérante pour l'affichage : une base injoignable ne doit pas faire tomber la page. */
export async function getViewerSafe(): Promise<Viewer | null> {
  try {
    return await getViewer();
  } catch {
    return null;
  }
}

/** Exige une session active (non suspendue) pour une mutation. */
export function requireActive(viewer: Viewer | null): Viewer {
  if (!viewer) throw new AppError("UNAUTHENTICATED", "Connecte-toi pour continuer.");
  if (viewer.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ton compte est suspendu.");
  if (viewer.status !== "ACTIVE") throw new AppError("FORBIDDEN", "Compte indisponible.");
  return viewer;
}

/**
 * Vérification d'adresse exigée pour créer, rejoindre ou inviter. Activée explicitement par
 * REQUIRE_EMAIL_VERIFICATION=true, une fois l'envoi d'e-mails configuré vers tous les destinataires
 * (domaine vérifié chez le fournisseur) : sinon des personnes resteraient bloquées sans lien.
 */
export function emailVerificationRequired(): boolean {
  return process.env.REQUIRE_EMAIL_VERIFICATION === "true";
}

/** Comme requireActive, plus l'adresse e-mail confirmée quand la vérification est exigée. */
export function requireVerified(viewer: Viewer | null): Viewer {
  const v = requireActive(viewer);
  if (!v.isDemo && !v.emailVerifiedAt && !v.phoneVerifiedAt && emailVerificationRequired()) {
    throw new AppError("EMAIL_NOT_VERIFIED", "Confirme ton adresse e-mail pour continuer : le lien est dans ta boîte de réception.");
  }
  return v;
}

/** Ferme toutes les sessions d'un compte (après un changement de mot de passe). */
export async function destroyAllSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

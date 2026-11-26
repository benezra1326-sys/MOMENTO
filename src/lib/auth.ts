import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { User } from "@prisma/client";
import { prisma } from "./db";
import { AppError } from "./errors";

export const SESSION_COOKIE = "momento_session";
const SESSION_DAYS = 30;

export type Viewer = Pick<User, "id" | "role" | "status" | "name" | "username" | "photoUrl" | "isDemo" | "city">;

const viewerSelect = {
  id: true, role: true, status: true, name: true, username: true, photoUrl: true, isDemo: true, city: true,
} as const;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

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

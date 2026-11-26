import { prisma } from "@/lib/db";
import { AppError, isUniqueViolation } from "@/lib/errors";
import { createSession, destroySession, requireActive, type Viewer } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { loginSchema, profileSchema, signupSchema } from "@/lib/validation";
import { isDemoMode } from "@/lib/env";
import { isBlockedBetween } from "./safety";
import { attendedMoments, hostedMoments } from "./moments";
import { notifyMany } from "./notifications";
import { deleteStoredFile } from "./storage";
import { sendVerificationEmail } from "./auth-tokens";

export async function signup(raw: unknown) {
  const input = signupSchema.parse(raw);
  const clash = await prisma.user.findFirst({
    where: { OR: [{ email: input.email }, { username: input.username }] },
    select: { email: true, username: true },
  });
  if (clash) {
    const details: Record<string, string> = {};
    if (clash.email === input.email) details.email = "Un compte existe déjà avec cet email.";
    if (clash.username === input.username) details.username = "Ce pseudo est déjà pris.";
    throw new AppError("CONFLICT", "Compte déjà existant.", details);
  }
  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        username: input.username,
        name: input.name,
        city: input.city,
        passwordHash: await hashPassword(input.password),
      },
    });
  } catch (e) {
    // Deux inscriptions simultanées : l'unicité en base tranche, on renvoie une erreur lisible.
    if (isUniqueViolation(e)) throw new AppError("CONFLICT", "Cet e-mail ou ce pseudo vient d'être pris. Réessaie.");
    throw e;
  }
  await createSession(user.id);
  // L'envoi ne doit jamais bloquer l'inscription.
  const verification = await sendVerificationEmail(user.id).catch(() => ({ sent: false }));
  return { id: user.id, username: user.username, verificationSent: verification.sent };
}

export async function login(raw: unknown) {
  const input = loginSchema.parse(raw);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const valid = user && user.status !== "DELETED" && (await verifyPassword(input.password, user.passwordHash));
  if (!user || !valid) throw new AppError("UNAUTHENTICATED", "Email ou mot de passe incorrect.");
  if (user.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
  await createSession(user.id);
  return { id: user.id, username: user.username };
}

/** Connexion en un clic à un profil fictif : uniquement en DEMO_MODE, uniquement pour les comptes démo. */
export async function demoLogin(username: string) {
  if (!isDemoMode()) throw new AppError("FORBIDDEN", "Le mode démo est désactivé.");
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.isDemo || user.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Profil démo introuvable.");
  await createSession(user.id);
  return { id: user.id, username: user.username };
}

export async function listDemoAccounts() {
  if (!isDemoMode()) return [];
  const select = { username: true, name: true, photoUrl: true, city: true, role: true, _count: { select: { hostedMoments: true } } } as const;
  const where = { isDemo: true, status: "ACTIVE" } as const;
  const [hosts, guests, admins] = await Promise.all([
    prisma.user.findMany({ where: { ...where, role: "USER", hostedMoments: { some: {} } }, select, orderBy: { hostedMoments: { _count: "desc" } }, take: 6 }),
    prisma.user.findMany({ where: { ...where, role: "USER", hostedMoments: { none: {} } }, select, orderBy: { createdAt: "asc" }, take: 4 }),
    prisma.user.findMany({ where: { ...where, role: "ADMIN" }, select, take: 1 }),
  ]);
  return [...hosts, ...guests, ...admins];
}

export async function logout() {
  await destroySession();
}

export async function getMyProfile(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id } });
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    username: u.username,
    bio: u.bio,
    city: u.city,
    interests: u.interests,
    photoUrl: u.photoUrl,
    showPastMoments: u.showPastMoments,
    autoplayVideos: u.autoplayVideos,
    isDemo: u.isDemo,
    role: u.role,
  };
}

export async function updateMyProfile(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = profileSchema.parse(raw);
  const before = await prisma.user.findUnique({ where: { id: viewer.id }, select: { photoUrl: true } });
  await prisma.user.update({
    where: { id: viewer.id },
    data: { ...input, interests: [...new Set(input.interests.map((i) => i.toLowerCase()))] },
  });
  if (before?.photoUrl && input.photoUrl !== undefined && before.photoUrl !== input.photoUrl) await deleteStoredFile(before.photoUrl);
  return getMyProfile(viewer);
}

/**
 * Profil public. Jamais d'email ni d'adresse. Les Moments vécus n'apparaissent que si la
 * personne l'autorise, et seulement pour les Moments visibles publiquement.
 */
export async function getPublicProfile(viewer: Viewer | null, username: string) {
  const u = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!u || u.status === "DELETED") throw new AppError("NOT_FOUND", "Ce profil n'existe pas.");
  if (viewer && (await isBlockedBetween(viewer.id, u.id))) throw new AppError("NOT_FOUND", "Ce profil n'existe pas.");
  const isSelf = viewer?.id === u.id;
  const viewerBlocked = viewer
    ? !!(await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: u.id } } }))
    : false;
  const suspended = u.status === "SUSPENDED";
  const [hosted, attended] = suspended
    ? [[], []]
    : await Promise.all([
        hostedMoments(viewer, u.id),
        u.showPastMoments || isSelf ? attendedMoments(viewer, u.id) : Promise.resolve([]),
      ]);
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    bio: u.bio,
    city: u.city,
    interests: u.interests,
    photoUrl: u.photoUrl,
    isDemo: u.isDemo,
    suspended,
    isSelf,
    viewerBlocked,
    memberSince: u.createdAt.toISOString(),
    showPastMoments: u.showPastMoments,
    hosted,
    attended,
  };
}

/**
 * Suppression de compte (politique documentée dans docs/ARCHITECTURE.md) :
 * - Moments à venir annulés et participants prévenus ;
 * - demandes et participations retirées ;
 * - données personnelles anonymisées, sessions supprimées ;
 * - le compte reste comme coquille « DELETED » pour l'intégrité des signalements.
 */
export async function deleteMyAccount(viewerIn: Viewer | null, confirmUsername: string) {
  const viewer = requireActive(viewerIn);
  if (confirmUsername.trim().toLowerCase() !== viewer.username) {
    throw new AppError("VALIDATION", "Saisis ton pseudo pour confirmer la suppression.");
  }
  const oldPhoto = (await prisma.user.findUnique({ where: { id: viewer.id }, select: { photoUrl: true } }))?.photoUrl;
  await prisma.$transaction(async (tx) => {
    const upcoming = await tx.moment.findMany({
      where: { hostId: viewer.id, status: { in: ["PUBLISHED", "DRAFT"] }, startsAt: { gt: new Date() } },
      select: { id: true, title: true },
    });
    for (const m of upcoming) {
      const members = await tx.momentMembership.findMany({
        where: { momentId: m.id, status: { in: ["ACCEPTED", "PENDING"] } },
        select: { userId: true },
      });
      await notifyMany(tx, members.map((x) => x.userId), {
        type: "MOMENT_CANCELLED",
        momentId: m.id,
        body: `« ${m.title} » a été annulé : l'hôte a supprimé son compte.`,
      });
    }
    await tx.moment.updateMany({
      where: { id: { in: upcoming.map((m) => m.id) } },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: "Compte de l'hôte supprimé." },
    });
    await tx.momentMembership.updateMany({
      where: { userId: viewer.id, status: { in: ["PENDING", "ACCEPTED"] } },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    await tx.notification.deleteMany({ where: { userId: viewer.id } });
    await tx.session.deleteMany({ where: { userId: viewer.id } });
    await tx.user.update({
      where: { id: viewer.id },
      data: {
        status: "DELETED",
        email: `deleted+${viewer.id}@momento.invalid`,
        username: `supprime_${viewer.id.slice(-10)}`,
        name: "Compte supprimé",
        bio: "",
        photoUrl: null,
        city: "",
        interests: [],
        passwordHash: null,
      },
    });
  });
  await deleteStoredFile(oldPhoto);
  await destroySession();
  return { deleted: true };
}

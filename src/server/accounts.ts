import { tierOf } from "@/lib/premium";
import { onProfilePhotoChanged } from "./verification";
import { endBillingForDeletedAccount } from "./billing";
import { recordView } from "./black";
import { z } from "zod";
import { ratedMoments, reputations } from "./ratings";
import { FEATURED_DEMO } from "./demo-data";
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
  // Une seule requête : la base de production n'accepte qu'une connexion par fonction.
  // Toujours les mêmes profils mis en avant, même avec une centaine de profils fictifs.
  const all = await prisma.user.findMany({
    where: { isDemo: true, status: "ACTIVE", username: { in: FEATURED_DEMO } },
    select: { username: true, name: true, photoUrl: true, city: true, role: true, _count: { select: { hostedMoments: true } } },
  });
  return all.sort((a, b) => FEATURED_DEMO.indexOf(a.username) - FEATURED_DEMO.indexOf(b.username));
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
    phone: u.phone,
    name: u.name,
    username: u.username,
    bio: u.bio,
    city: u.city,
    interests: u.interests,
    photoUrl: u.photoUrl,
    showPastMoments: u.showPastMoments,
    autoplayVideos: u.autoplayVideos,
    instagram: u.instagram,
    gallery: u.gallery,
    showAdult: u.showAdult,
    adultConfirmedAt: u.adultConfirmedAt ? u.adultConfirmedAt.toISOString() : null,
    isDemo: u.isDemo,
    role: u.role,
    verified: !!u.photoVerifiedAt && !!u.photoUrl,
  };
}

/**
 * Moments 18+ : opt-in explicite. Pour l'activer, la personne confirme avoir 18 ans ou plus
 * et accepte les règles (consentement, respect, discrétion). Elle peut le désactiver à tout moment.
 */
export async function setAdultSpace(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = z.object({ enable: z.boolean(), confirm18: z.boolean().default(false), acceptRules: z.boolean().default(false) }).parse(raw ?? {});
  if (input.enable && (!input.confirm18 || !input.acceptRules)) {
    throw new AppError("VALIDATION", "Confirme avoir 18 ans ou plus et accepter les règles des Moments 18+.");
  }
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { adultConfirmedAt: true } });
  await prisma.user.update({
    where: { id: viewer.id },
    data: { showAdult: input.enable, ...(input.enable && !u.adultConfirmedAt ? { adultConfirmedAt: new Date() } : {}) },
  });
  return { showAdult: input.enable };
}

export async function updateMyProfile(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = profileSchema.parse(raw);
  const before = await prisma.user.findUnique({ where: { id: viewer.id }, select: { photoUrl: true, gallery: true } });
  const { instagram, gallery, ...rest } = input;
  await prisma.user.update({
    where: { id: viewer.id },
    data: {
      ...rest,
      interests: [...new Set(input.interests.map((i) => i.toLowerCase()))],
      ...(instagram !== undefined ? { instagram: instagram ? instagram.toLowerCase() : null } : {}),
      ...(gallery !== undefined ? { gallery: [...new Set(gallery)] } : {}),
    },
  });
  if (input.photoUrl !== undefined && (before?.photoUrl ?? null) !== (input.photoUrl ?? null)) await onProfilePhotoChanged(viewer.id, input.photoUrl ?? null);
  if (before?.photoUrl && input.photoUrl !== undefined && before.photoUrl !== input.photoUrl) await deleteStoredFile(before.photoUrl);
  if (gallery !== undefined) for (const url of before?.gallery ?? []) if (!gallery.includes(url)) await deleteStoredFile(url);
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
  await recordView(viewer, u.id, "profile");
  const viewerBlocked = viewer
    ? !!(await prisma.block.findUnique({ where: { blockerId_blockedId: { blockerId: viewer.id, blockedId: u.id } } }))
    : false;
  const suspended = u.status === "SUSPENDED";
  // Requêtes séquentielles : une seule connexion à la base en production.
  const hosted = suspended ? [] : await hostedMoments(viewer, u.id);
  const attended = suspended || !(u.showPastMoments || isSelf) ? [] : await attendedMoments(viewer, u.id);
  const rep = (await reputations([u.id])).get(u.id) ?? null;
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    bio: u.bio,
    city: u.city,
    interests: u.interests,
    photoUrl: u.photoUrl,
    isDemo: u.isDemo,
    verified: !!u.photoVerifiedAt && !!u.photoUrl && !suspended,
    tier: suspended ? ("free" as const) : tierOf(u),
    suspended,
    isSelf,
    viewerBlocked,
    memberSince: u.createdAt.toISOString(),
    showPastMoments: u.showPastMoments,
    instagram: suspended ? null : u.instagram,
    gallery: suspended ? [] : u.gallery,
    reputation: rep ? { avg: rep.avg, count: rep.count, hostAvg: rep.hostAvg, hostCount: rep.hostCount, criteria: rep.criteria, badges: rep.badges, qualities: rep.qualities, againPct: rep.againPct } : null,
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
  const selfies = (await prisma.photoVerification.findMany({ where: { userId: viewer.id }, select: { selfieUrl: true } })).map((v) => v.selfieUrl).filter(Boolean);
  await endBillingForDeletedAccount(viewer.id);
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
    await tx.photoVerification.deleteMany({ where: { userId: viewer.id } });
    await tx.notification.deleteMany({ where: { userId: viewer.id } });
    await tx.session.deleteMany({ where: { userId: viewer.id } });
    await tx.user.update({
      where: { id: viewer.id },
      data: {
        status: "DELETED",
        email: `deleted+${viewer.id}@upclose.invalid`,
        username: `supprime_${viewer.id.slice(-10)}`,
        name: "Compte supprimé",
        bio: "",
        photoUrl: null,
        city: "",
        interests: [],
        passwordHash: null,
        googleId: null,
        facebookId: null,
        phone: null,
        phoneVerifiedAt: null,
        photoVerifiedAt: null,
      },
    });
  });
  await deleteStoredFile(oldPhoto);
  for (const url of new Set(selfies)) await deleteStoredFile(url);
  await destroySession();
  return { deleted: true };
}

/** Page « Avis » d'un profil : la note, ses critères et les Moments qui l'ont construite. */
export async function getProfileReviews(viewer: Viewer | null, username: string) {
  const u = await prisma.user.findUnique({ where: { username: username.toLowerCase() } });
  if (!u || u.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Ce profil n'existe pas.");
  if (viewer && (await isBlockedBetween(viewer.id, u.id))) throw new AppError("NOT_FOUND", "Ce profil n'existe pas.");
  const reputation = (await reputations([u.id])).get(u.id) ?? null;
  const { moments, hidden } = await ratedMoments(viewer, u);
  return { name: u.name, username: u.username, isDemo: u.isDemo, reputation, moments, hidden };
}

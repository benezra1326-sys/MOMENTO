/**
 * Chargement du jeu de démonstration (profils fictifs, Moments, participations, notifications,
 * signalements). Partagé par prisma/seed.ts (base locale) et /api/admin/demo-seed (production).
 *
 * Ne touche QUE les comptes @demo.momento.app (isDemo) et leurs Moments : un vrai compte n'est
 * jamais modifié. Requêtes séquentielles : la base de production n'accepte qu'une connexion.
 */
import type { PrismaClient } from "@prisma/client";
import { buildDemoDataset } from "./demo-dataset";

export async function seedDemo(db: PrismaClient, passwordHash: string, now = new Date()) {
  const data = buildDemoDataset(now);
  const ids = new Map<string, string>();

  for (const u of data.users) {
    const existing = await db.user.findUnique({ where: { email: u.email } });
    if (existing && !existing.isDemo) throw new Error(`${u.email} existe et n'est pas un compte démo : arrêt.`);
    const fields = { name: u.name, username: u.username, city: u.city, bio: u.bio, interests: u.interests, photoUrl: u.photoUrl, isDemo: true, role: u.role, status: "ACTIVE" as const, passwordHash };
    const row = await db.user.upsert({ where: { email: u.email }, create: { email: u.email, createdAt: u.createdAt, ...fields }, update: fields });
    ids.set(u.username, row.id);
  }

  // On repart de zéro pour les seuls Moments de démo (et leurs participations, en cascade),
  // y compris ceux de profils fictifs d'une version précédente du jeu de données.
  const demoUserIds = [...ids.values()];
  const allDemo = await db.user.findMany({ where: { isDemo: true, email: { endsWith: "@demo.momento.app" } }, select: { id: true } });
  const allDemoIds = allDemo.map((u) => u.id);
  const staleIds = allDemoIds.filter((x) => !demoUserIds.includes(x));
  await db.moment.deleteMany({ where: { isDemo: true, hostId: { in: allDemoIds } } });
  await db.notification.deleteMany({ where: { userId: { in: allDemoIds } } });
  await db.report.deleteMany({ where: { reporterId: { in: allDemoIds } } });
  await db.block.deleteMany({ where: { blockerId: { in: allDemoIds }, blockedId: { in: allDemoIds } } });
  // Profils fictifs qui ne font plus partie du jeu : suspendus (jamais supprimés), donc invisibles.
  if (staleIds.length) await db.user.updateMany({ where: { id: { in: staleIds }, isDemo: true }, data: { status: "SUSPENDED" } });

  const id = (slug: string) => ids.get(slug)!;
  await db.moment.createMany({
    data: data.moments.map(({ host, ...m }) => ({ ...m, hostId: id(host), timezone: "Europe/Madrid", addressMembersOnly: true, isDemo: true })),
  });
  await db.momentMembership.createMany({
    data: data.memberships.map(({ user, initiator, ...m }) => ({ ...m, userId: id(user), initiatorId: id(initiator) })),
  });
  await db.notification.createMany({
    data: data.notifications.map(({ user, actor, ...n }) => ({ ...n, userId: id(user), actorId: actor ? id(actor) : null })),
  });
  await db.report.createMany({
    data: data.reports.map(({ reporter, targetUser, ...x }) => ({ ...x, reporterId: id(reporter), targetUserId: targetUser ? id(targetUser) : null })),
  });

  return { users: data.users.length, moments: data.moments.length, memberships: data.memberships.length, notifications: data.notifications.length, reports: data.reports.length };
}

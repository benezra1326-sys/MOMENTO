/**
 * Seed de démonstration Momento.
 *
 *   npm run db:seed
 *
 * - Ne touche QUE les données marquées isDemo (comptes @demo.momento.app et leurs Moments).
 *   Les vrais comptes et leurs Moments ne sont jamais modifiés ni supprimés.
 * - Les dates sont relatives au jour du seed : le feed a toujours des Moments à venir.
 * - Refuse de tourner en production sauf SEED_ALLOW_PRODUCTION=true.
 *   En production, préférer scripts/demo-sql.ts (même jeu de données, en SQL).
 */
import { PrismaClient } from "@prisma/client";
import { buildDemoDataset } from "../src/server/demo-dataset";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "momento-demo";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Seed de démo refusé en production (SEED_ALLOW_PRODUCTION=true pour forcer).");
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const data = buildDemoDataset();
  const ids = new Map<string, string>();

  for (const u of data.users) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing && !existing.isDemo) throw new Error(`${u.email} existe et n'est pas un compte démo : arrêt.`);
    const fields = { name: u.name, username: u.username, city: u.city, bio: u.bio, interests: u.interests, photoUrl: u.photoUrl, isDemo: true, role: u.role, status: "ACTIVE" as const, passwordHash };
    const row = await prisma.user.upsert({ where: { email: u.email }, create: { email: u.email, createdAt: u.createdAt, ...fields }, update: fields });
    ids.set(u.username, row.id);
  }

  // On repart de zéro pour les seuls Moments de démo (et leurs participations, en cascade).
  const demoUserIds = [...ids.values()];
  await prisma.moment.deleteMany({ where: { isDemo: true, hostId: { in: demoUserIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.report.deleteMany({ where: { reporterId: { in: demoUserIds } } });
  await prisma.block.deleteMany({ where: { blockerId: { in: demoUserIds }, blockedId: { in: demoUserIds } } });

  const id = (slug: string) => ids.get(slug)!;
  await prisma.moment.createMany({
    data: data.moments.map(({ host, ...m }) => ({ ...m, hostId: id(host), timezone: "Europe/Madrid", addressMembersOnly: true, isDemo: true })),
  });
  await prisma.momentMembership.createMany({
    data: data.memberships.map(({ user, initiator, ...m }) => ({ ...m, userId: id(user), initiatorId: id(initiator) })),
  });
  await prisma.notification.createMany({
    data: data.notifications.map(({ user, actor, ...n }) => ({ ...n, userId: id(user), actorId: actor ? id(actor) : null })),
  });
  await prisma.report.createMany({
    data: data.reports.map(({ reporter, targetUser, ...x }) => ({ ...x, reporterId: id(reporter), targetUserId: targetUser ? id(targetUser) : null })),
  });

  console.log(
    `Seed démo : ${data.users.length} profils fictifs, ${data.moments.length} Moments, ${data.memberships.length} participations, ` +
      `${data.notifications.length} notifications, ${data.reports.length} signalements. Mot de passe démo : ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

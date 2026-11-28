import type { NotificationType, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireActive, type Viewer } from "@/lib/auth";

type Db = PrismaClient | Prisma.TransactionClient;

export async function notify(
  db: Db,
  n: { userId: string; type: NotificationType; momentId?: string; actorId?: string; body: string },
) {
  await db.notification.create({ data: n });
}

export async function notifyMany(
  db: Db,
  userIds: string[],
  n: { type: NotificationType; momentId?: string; actorId?: string; body: string },
) {
  if (userIds.length === 0) return;
  await db.notification.createMany({ data: userIds.map((userId) => ({ ...n, userId })) });
}

export async function listNotifications(viewerIn: Viewer | null, limit = 40) {
  const viewer = requireActive(viewerIn);
  const rows = await prisma.notification.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  // Requête séquentielle (une seule connexion en production) : la personne à l'origine de chaque notification.
  const actorIds = [...new Set(rows.map((r) => r.actorId).filter((x): x is string => !!x))];
  const actors = actorIds.length
    ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, username: true, photoUrl: true, photoVerifiedAt: true } })
    : [];
  const byId = new Map(actors.map((a) => [a.id, a]));
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    momentId: r.momentId,
    actor: r.actorId && byId.get(r.actorId) ? { ...byId.get(r.actorId)!, verified: !!byId.get(r.actorId)!.photoVerifiedAt } : null,
    read: !!r.readAt,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function unreadCount(viewerId: string) {
  return prisma.notification.count({ where: { userId: viewerId, readAt: null } });
}

export async function markAllRead(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  await prisma.notification.updateMany({ where: { userId: viewer.id, readAt: null }, data: { readAt: new Date() } });
  return { ok: true };
}

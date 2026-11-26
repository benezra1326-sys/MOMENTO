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
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    body: r.body,
    momentId: r.momentId,
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

import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { blockedUserIds } from "./safety";
import { personSelect, toPerson } from "./mappers";
import { circleIds, requireCircle } from "./participation";
import type { PersonSummary } from "./types";

/**
 * Discussion liée à un Moment : pas de messagerie générale entre inconnus. Seuls l'hôte et les
 * participants confirmés y ont accès, le temps de s'organiser (point de rendez-vous, retard…).
 * Les blocages s'appliquent : on ne voit pas les messages d'une personne bloquée.
 */

export type MessageDTO = { id: string; body: string; createdAt: string; author: PersonSummary; mine: boolean };

const messageSchema = z.object({
  body: z.string().trim().min(1, "Écris un message.").max(productConfig.limits.messageMaxLength, `${productConfig.limits.messageMaxLength} caractères maximum.`),
});

function assertMessaging() {
  if (!productConfig.features.messaging) throw new AppError("NOT_FOUND", "La discussion n'est pas ouverte.");
}

export async function listMessages(viewerIn: Viewer | null, momentId: string, after?: string | null): Promise<MessageDTO[]> {
  assertMessaging();
  const viewer = requireActive(viewerIn);
  await requireCircle(viewer, momentId);
  const blocked = await blockedUserIds(viewer.id);
  const since = after ? new Date(after) : null;
  const rows = await prisma.momentMessage.findMany({
    where: {
      momentId,
      deletedAt: null,
      ...(blocked.length ? { authorId: { notIn: blocked } } : {}),
      ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}),
    },
    include: { author: { select: personSelect } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  // Les notifications de discussion de ce Moment sont considérées comme lues.
  await prisma.notification.updateMany({ where: { userId: viewer.id, momentId, type: "NEW_MESSAGE", readAt: null }, data: { readAt: new Date() } });
  return rows.reverse().map((r) => ({ id: r.id, body: r.body, createdAt: r.createdAt.toISOString(), author: toPerson(r.author), mine: r.authorId === viewer.id }));
}

export async function postMessage(viewerIn: Viewer | null, momentId: string, raw: unknown): Promise<MessageDTO> {
  assertMessaging();
  const viewer = requireActive(viewerIn);
  const { moment } = await requireCircle(viewer, momentId);
  if (moment.status === "CANCELLED") throw new AppError("MOMENT_NOT_OPEN", "Ce Moment a été annulé.");
  const { body } = messageSchema.parse(raw ?? {});
  const recent = await prisma.momentMessage.count({ where: { authorId: viewer.id, createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= productConfig.limits.messagesPerHour) throw new AppError("RATE_LIMITED", "Trop de messages en une heure. Réessaie plus tard.");

  const msg = await prisma.momentMessage.create({ data: { momentId, authorId: viewer.id, body }, include: { author: { select: personSelect } } });

  // Une seule notification non lue par Moment et par personne : pas d'avalanche.
  const others = (await circleIds(momentId, moment.hostId)).filter((id) => id !== viewer.id);
  if (others.length) {
    const already = await prisma.notification.findMany({
      where: { userId: { in: others }, momentId, type: "NEW_MESSAGE", readAt: null },
      select: { userId: true },
    });
    const skip = new Set(already.map((n) => n.userId));
    const targets = others.filter((id) => !skip.has(id));
    if (targets.length) {
      await prisma.notification.createMany({
        data: targets.map((userId) => ({ userId, type: "NEW_MESSAGE" as const, momentId, actorId: viewer.id, body: `Nouveau message dans « ${moment.title} ».` })),
      });
    }
  }
  return { id: msg.id, body: msg.body, createdAt: msg.createdAt.toISOString(), author: toPerson(msg.author), mine: true };
}

/** Retirer son propre message (l'hôte peut aussi retirer un message de sa discussion). */
export async function deleteMessage(viewerIn: Viewer | null, momentId: string, messageId: string) {
  assertMessaging();
  const viewer = requireActive(viewerIn);
  const { isHost } = await requireCircle(viewer, momentId);
  const msg = await prisma.momentMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.momentId !== momentId || msg.deletedAt) throw new AppError("NOT_FOUND", "Message introuvable.");
  if (msg.authorId !== viewer.id && !isHost) throw new AppError("FORBIDDEN", "Tu ne peux retirer que tes messages.");
  await prisma.momentMessage.update({ where: { id: messageId }, data: { deletedAt: new Date() } });
  return { deleted: true };
}

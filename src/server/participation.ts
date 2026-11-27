import type { Moment } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { Viewer } from "@/lib/auth";
import { momentPhase } from "./mappers";

export type Participation = { moment: Moment; isHost: boolean; isMember: boolean };

/**
 * Le « cercle » d'un Moment : l'hôte et les participants dont la place est confirmée.
 * C'est lui seul qui peut lire et écrire la discussion, partager des souvenirs et se noter.
 */
export async function circleOf(viewer: Viewer, momentId: string): Promise<Participation> {
  const moment = await prisma.moment.findUnique({ where: { id: momentId } });
  if (!moment) throw new AppError("NOT_FOUND", "Moment introuvable.");
  const isHost = moment.hostId === viewer.id;
  const membership = isHost
    ? null
    : await prisma.momentMembership.findUnique({ where: { momentId_userId: { momentId, userId: viewer.id } }, select: { status: true } });
  return { moment, isHost, isMember: isHost || membership?.status === "ACCEPTED" };
}

export async function requireCircle(viewer: Viewer, momentId: string): Promise<Participation> {
  const p = await circleOf(viewer, momentId);
  if (!p.isMember) throw new AppError("FORBIDDEN", "Réservé à l'hôte et aux participants confirmés.");
  return p;
}

/** Identifiants du cercle (hôte + participants confirmés). */
export async function circleIds(momentId: string, hostId: string): Promise<string[]> {
  const rows = await prisma.momentMembership.findMany({ where: { momentId, status: "ACCEPTED" }, select: { userId: true } });
  return [hostId, ...rows.map((r) => r.userId)];
}

export function hasEnded(m: Moment) {
  return momentPhase(m) === "ended";
}

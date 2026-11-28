import type { Moment, MomentMembership, User } from "@prisma/client";
import { momentEnd } from "@/lib/time";
import type { MomentCardDTO, MomentPhase, PersonSummary, ViewerMembership } from "./types";

export const personSelect = { id: true, name: true, username: true, photoUrl: true, isDemo: true } as const;

export function toPerson(u: Pick<User, "id" | "name" | "username" | "photoUrl" | "isDemo">): PersonSummary {
  return { id: u.id, name: u.name, username: u.username, photoUrl: u.photoUrl, isDemo: u.isDemo };
}

export function momentPhase(m: Pick<Moment, "status" | "startsAt" | "endsAt">, now = new Date()): MomentPhase {
  if (m.status === "DRAFT") return "draft";
  if (m.status === "CANCELLED") return "cancelled";
  if (momentEnd(m.startsAt, m.endsAt) < now) return "ended";
  if (m.startsAt <= now) return "ongoing";
  return "upcoming";
}

type MomentWithRelations = Moment & {
  host: Pick<User, "id" | "name" | "username" | "photoUrl" | "isDemo">;
  memberships: (Pick<MomentMembership, "status" | "showOnMoment"> & {
    user: Pick<User, "id" | "name" | "username" | "photoUrl" | "isDemo">;
  })[];
  _count?: { memberships: number };
};

export function toCard(
  m: MomentWithRelations,
  acceptedCount: number,
  viewerId: string | null,
  viewerMembership: MomentMembership | null,
): MomentCardDTO {
  const isHost = viewerId === m.hostId;
  const membership: ViewerMembership = viewerMembership
    ? {
        id: viewerMembership.id,
        kind: viewerMembership.kind,
        status: viewerMembership.status,
        initiatedByViewer: viewerMembership.initiatorId === viewerId,
      }
    : null;
  const attendeesPreview =
    m.showAttendees || isHost
      ? m.memberships.filter((x) => x.status === "ACCEPTED" && (x.showOnMoment || isHost)).map((x) => toPerson(x.user))
      : [];
  return {
    id: m.id,
    title: m.title,
    description: m.description,
    category: m.category,
    vibeTags: m.vibeTags,
    mediaType: m.mediaType,
    mediaUrl: m.mediaUrl,
    posterUrl: m.posterUrl,
    textTheme: m.textTheme,
    city: m.city,
    area: m.area,
    placeName: m.placeName,
    startsAt: m.startsAt.toISOString(),
    endsAt: m.endsAt ? m.endsAt.toISOString() : null,
    timezone: m.timezone,
    capacity: m.capacity,
    acceptedCount,
    spotsLeft: Math.max(0, m.capacity - acceptedCount),
    status: m.status,
    visibility: m.visibility,
    phase: momentPhase(m),
    isAdult: m.isAdult,
    isDemo: m.isDemo,
    isNew: Date.now() - (m.publishedAt ?? m.createdAt).getTime() < 48 * 3600_000,
    boosted: !!m.boostedUntil && m.boostedUntil.getTime() > Date.now(),
    host: toPerson(m.host),
    attendeesPreview: attendeesPreview.slice(0, 5),
    viewerMembership: membership,
    isHost,
  };
}

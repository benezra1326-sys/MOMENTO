import type { Moment, MomentMembership, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, requireVerified, type Viewer } from "@/lib/auth";
import { ADULT_CATEGORY, productConfig } from "@/config/product";
import { cancelMomentSchema, feedQuerySchema, momentInputSchema, type FeedQuery } from "@/lib/validation";
import { momentEnd, utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { blockedUserIds, isBlockedBetween } from "./safety";
import { deleteStoredFile } from "./storage";
import { notifyMany } from "./notifications";
import { momentPhase, personSelect, toCard, toPerson } from "./mappers";
import { rankContext, scoreMoment } from "./recommend";
import type { FeedPage, MemberRow, MomentCardDTO, MomentDetailDTO } from "./types";

const cardInclude = {
  host: { select: personSelect },
  memberships: {
    where: { status: "ACCEPTED" as const },
    orderBy: { respondedAt: "asc" as const },
    take: 8,
    select: { status: true, showOnMoment: true, user: { select: personSelect } },
  },
} satisfies Prisma.MomentInclude;

/** Nombre de places confirmées par Moment. */
export async function acceptedCounts(momentIds: string[]): Promise<Map<string, number>> {
  if (momentIds.length === 0) return new Map();
  const rows = await prisma.momentMembership.groupBy({
    by: ["momentId"],
    where: { momentId: { in: momentIds }, status: "ACCEPTED" },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.momentId, r._count._all]));
}

async function viewerMemberships(viewerId: string | null, momentIds: string[]) {
  if (!viewerId || momentIds.length === 0) return new Map<string, MomentMembership>();
  const rows = await prisma.momentMembership.findMany({ where: { userId: viewerId, momentId: { in: momentIds } } });
  return new Map(rows.map((r) => [r.momentId, r]));
}

export async function toCards(moments: (Moment & Prisma.MomentGetPayload<{ include: typeof cardInclude }>)[], viewerId: string | null) {
  const ids = moments.map((m) => m.id);
  const counts = await acceptedCounts(ids);
  const mine = await viewerMemberships(viewerId, ids);
  return moments.map((m) => toCard(m, counts.get(m.id) ?? 0, viewerId, mine.get(m.id) ?? null));
}

// ——— Feed ———

/** L'espace adulte n'est visible que pour les membres majeurs qui l'ont activé eux-mêmes. */
export function canSeeAdult(viewer: Pick<Viewer, "showAdult" | "adultConfirmedAt"> | null): boolean {
  return !!viewer && productConfig.features.adultSpace && viewer.showAdult && !!viewer.adultConfirmedAt;
}

function encodeCursor(date: Date, id: string) {
  return Buffer.from(`${date.toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { date: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
    const date = new Date(iso);
    if (!id || Number.isNaN(date.getTime())) return null;
    return { date, id };
  } catch {
    return null;
  }
}

function dayStart(local: Date, tz: string, addDays = 0) {
  const d = new Date(local.getTime() + addDays * 86400_000);
  const ymd = utcToZonedLocal(d, tz).slice(0, 10);
  return zonedLocalToUtc(`${ymd}T00:00`, tz);
}

/** Bornes de date pour les raccourcis « aujourd'hui », « demain », « ce week-end », « 7 jours ». */
export function whenRange(when: FeedQuery["when"], now = new Date(), tz = productConfig.defaultTimezone) {
  if (!when) return null;
  if (when === "today") return { gte: now, lt: dayStart(now, tz, 1) };
  if (when === "tomorrow") return { gte: dayStart(now, tz, 1), lt: dayStart(now, tz, 2) };
  if (when === "week") return { gte: now, lt: dayStart(now, tz, 8) };
  // week-end : du vendredi 18 h au dimanche soir (dans le fuseau par défaut)
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  const daysToFri = idx === 0 ? -2 : idx === 6 ? -1 : 5 - idx;
  const friday = dayStart(now, tz, daysToFri);
  const start = new Date(Math.max(now.getTime(), friday.getTime() + 18 * 3600_000));
  return { gte: start, lt: dayStart(now, tz, daysToFri + 3) };
}

/**
 * Feed déterministe et explicable : Moments publiés, visibles dans le feed (Ouvert / Sur demande),
 * pas encore terminés, triés par date de début (ou par publication récente).
 * Les Moments complets restent visibles avec la mention « Complet ».
 */
export async function getFeed(viewer: Viewer | null, rawQuery: unknown): Promise<FeedPage> {
  const q = feedQuerySchema.parse(rawQuery ?? {});
  const now = new Date();
  const limit = q.limit ?? productConfig.limits.feedPageSize;
  const sort = q.sort ?? productConfig.defaultSort;
  const blocked = await blockedUserIds(viewer?.id ?? null);

  const range = whenRange(q.when, now);
  // Un Moment en cours (commencé il y a moins de 3 h) reste visible.
  const minStart = new Date(now.getTime() - 3 * 3600_000);
  const startsAt: Prisma.DateTimeFilter = range
    ? { gte: range.gte < minStart ? minStart : range.gte, lt: range.lt }
    : { gte: q.from ? zonedLocalToUtc(`${q.from}T00:00`, productConfig.defaultTimezone) : minStart };

  const where: Prisma.MomentWhereInput = {
    status: "PUBLISHED",
    visibility: { in: ["PUBLIC", "REQUEST"] },
    startsAt,
    host: { status: "ACTIVE" },
    ...(canSeeAdult(viewer) ? {} : { isAdult: false }),
    ...(blocked.length ? { hostId: { notIn: blocked } } : {}),
    ...(q.city ? { city: { equals: q.city, mode: "insensitive" } } : {}),
    ...(q.category ? { category: q.category } : {}),
  };

  if (sort === "best") {
    // « Pour toi » : on classe une fenêtre de Moments à venir, puis on pagine par position.
    const offset = q.cursor?.startsWith("o") ? Math.max(0, parseInt(q.cursor.slice(1), 10) || 0) : 0;
    const pool = await prisma.moment.findMany({ where, include: cardInclude, orderBy: [{ startsAt: "asc" }, { id: "asc" }], take: 150 });
    const counts = await acceptedCounts(pool.map((m) => m.id));
    const ctx = await rankContext(viewer, pool.map((m) => m.hostId));
    const ranked = pool
      .filter((m) => momentPhase(m, now) !== "ended")
      .map((m) => ({ m, s: scoreMoment(m, counts.get(m.id) ?? 0, ctx, now) }))
      .sort((a, b) => b.s.score - a.s.score || a.m.startsAt.getTime() - b.m.startsAt.getTime());
    const slice = ranked.slice(offset, offset + limit);
    const mine = await viewerMemberships(viewer?.id ?? null, slice.map((x) => x.m.id));
    const items = slice.map(({ m, s }) => {
      const rep = ctx.reps.get(m.hostId);
      const card = toCard(m, counts.get(m.id) ?? 0, viewer?.id ?? null, mine.get(m.id) ?? null);
      return { ...card, reasons: viewer ? s.reasons : [], hostRating: rep && (rep.hostAvg ?? rep.avg) !== null ? { avg: (rep.hostAvg ?? rep.avg)!, count: rep.hostAvg !== null ? rep.hostCount : rep.count } : null };
    });
    return { items, nextCursor: offset + limit < ranked.length ? `o${offset + limit}` : null, source: "database" };
  }

  const cursor = q.cursor ? decodeCursor(q.cursor) : null;
  const sortField = sort === "recent" ? "publishedAt" : "startsAt";
  if (cursor) {
    const cmp = sort === "recent" ? "lt" : "gt";
    where.AND = [
      {
        OR: [
          { [sortField]: { [cmp]: cursor.date } },
          { [sortField]: cursor.date, id: { [cmp]: cursor.id } },
        ],
      },
    ];
  }

  const dir = sort === "recent" ? "desc" : "asc";
  const rows = await prisma.moment.findMany({
    where,
    include: cardInclude,
    orderBy: [{ [sortField]: dir }, { id: dir }],
    take: limit + 1,
  });
  // Les Moments terminés (heure de fin passée) sortent du feed.
  const page = rows.slice(0, limit);
  const items = (await toCards(page, viewer?.id ?? null)).filter((c) => c.phase !== "ended");
  const last = page[page.length - 1];
  const lastDate = last ? (sort === "recent" ? last.publishedAt ?? last.createdAt : last.startsAt) : null;
  return {
    items,
    nextCursor: rows.length > limit && last && lastDate ? encodeCursor(lastDate, last.id) : null,
    source: "database",
  };
}

// ——— Détail et contrôle d'accès ———

/**
 * Règles de lecture d'un Moment :
 * - brouillon : hôte uniquement ;
 * - sur invitation : hôte + personnes ayant une invitation ou une participation ;
 * - privé : toute personne ayant le lien ;
 * - blocage dans un sens ou l'autre : introuvable ;
 * - l'adresse exacte n'est donnée qu'à l'hôte et aux participants acceptés si l'hôte l'a choisi.
 */
export async function getMomentDetail(viewer: Viewer | null, id: string): Promise<MomentDetailDTO> {
  const m = await prisma.moment.findUnique({ where: { id }, include: { ...cardInclude, host: { select: { ...personSelect, status: true } } } });
  if (!m) throw new AppError("NOT_FOUND", "Ce Moment n'existe pas ou a été supprimé.");
  const viewerId = viewer?.id ?? null;
  const isHost = viewerId === m.hostId;
  const membership = viewerId
    ? await prisma.momentMembership.findUnique({ where: { momentId_userId: { momentId: id, userId: viewerId } } })
    : null;

  if (!isHost) {
    if (m.status === "DRAFT") throw new AppError("NOT_FOUND", "Ce Moment n'existe pas ou a été supprimé.");
    if (m.host.status !== "ACTIVE") throw new AppError("NOT_FOUND", "Ce Moment n'est plus disponible.");
    if (viewerId && (await isBlockedBetween(viewerId, m.hostId))) {
      throw new AppError("NOT_FOUND", "Ce Moment n'existe pas ou a été supprimé.");
    }
    if (m.visibility === "INVITE_ONLY" && !membership) {
      throw new AppError("FORBIDDEN", "Ce Moment est sur invitation uniquement.");
    }
    if (m.isAdult && !canSeeAdult(viewer) && !membership) {
      throw new AppError("ADULT_ONLY", "Ce Moment fait partie de l'espace adulte (18+). Active-le dans ton profil pour le voir.");
    }
  }

  const counts = await acceptedCounts([id]);
  const pendingCount = isHost ? await prisma.momentMembership.count({ where: { momentId: id, status: "PENDING", kind: "REQUEST" } }) : 0;
  const card = toCard(m, counts.get(id) ?? 0, viewerId, membership);
  const canSeeAddress = !m.addressMembersOnly || isHost || membership?.status === "ACCEPTED";

  let members: MemberRow[] | null = null;
  if (isHost) {
    const rows = await prisma.momentMembership.findMany({
      where: { momentId: id },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      include: { user: { select: personSelect } },
    });
    members = rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
      user: toPerson(r.user),
    }));
  }

  const attendees =
    m.showAttendees || isHost
      ? (
          await prisma.momentMembership.findMany({
            where: { momentId: id, status: "ACCEPTED", ...(isHost ? {} : { showOnMoment: true }) },
            include: { user: { select: personSelect } },
            orderBy: { respondedAt: "asc" },
          })
        ).map((r) => toPerson(r.user))
      : [];

  return {
    ...card,
    address: canSeeAddress ? m.address : null,
    addressHidden: !!m.address && !canSeeAddress,
    addressMembersOnly: m.addressMembersOnly,
    showAttendees: m.showAttendees,
    cancelReason: m.cancelReason,
    attendees,
    members,
    pendingCount,
  };
}

// ——— Création / édition ———

function toMomentData(input: ReturnType<typeof momentInputSchema.parse>, viewer: Viewer) {
  const isAdult = input.category === ADULT_CATEGORY;
  if (isAdult && !canSeeAdult(viewer)) {
    throw new AppError("ADULT_ONLY", "Active l'espace adulte (18+) dans ton profil pour créer ce type de Moment.", {
      category: "Active d'abord l'espace adulte dans ton profil.",
    });
  }
  if (isAdult && input.visibility === "PUBLIC") {
    throw new AppError("VALIDATION", "Un Moment adulte se fait sur demande ou sur invitation : tu choisis chaque personne.", {
      visibility: "Choisis « Sur demande » ou « Sur invitation ».",
    });
  }
  const startsAt = zonedLocalToUtc(input.startsAtLocal, input.timezone);
  const endsAt = input.endsAtLocal ? zonedLocalToUtc(input.endsAtLocal, input.timezone) : null;
  if (Number.isNaN(startsAt.getTime())) throw new AppError("VALIDATION", "Date invalide.", { startsAtLocal: "Date invalide." });
  if (endsAt && endsAt <= startsAt) {
    throw new AppError("VALIDATION", "La fin doit être après le début.", { endsAtLocal: "La fin doit être après le début." });
  }
  return {
    title: input.title,
    description: input.description,
    category: input.category,
    vibeTags: [...new Set(input.vibeTags.map((t) => t.toLowerCase()))],
    mediaType: input.mediaType,
    mediaUrl: input.mediaType === "TEXT" ? null : input.mediaUrl ?? null,
    posterUrl: input.mediaType === "VIDEO" ? input.posterUrl ?? null : null,
    textTheme: input.textTheme ?? "dusk",
    city: input.city,
    area: input.area,
    placeName: input.placeName,
    address: input.address || null,
    addressMembersOnly: input.addressMembersOnly,
    startsAt,
    endsAt,
    timezone: input.timezone,
    capacity: input.capacity,
    visibility: input.visibility,
    // Espace adulte : participants jamais affichés publiquement.
    showAttendees: isAdult ? false : input.showAttendees,
    isAdult,
  };
}

export async function createMoment(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireVerified(viewerIn);
  const input = momentInputSchema.parse(raw);
  const data = toMomentData(input, viewer);
  if (input.publish && data.startsAt < new Date()) {
    throw new AppError("VALIDATION", "Choisis une date à venir.", { startsAtLocal: "Choisis une date à venir." });
  }
  const m = await prisma.moment.create({
    data: {
      ...data,
      hostId: viewer.id,
      status: input.publish ? "PUBLISHED" : "DRAFT",
      publishedAt: input.publish ? new Date() : null,
    },
  });
  return { id: m.id, status: m.status };
}

async function loadOwnMoment(viewer: Viewer, id: string) {
  const m = await prisma.moment.findUnique({ where: { id } });
  if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
  if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Seul l'hôte peut modifier ce Moment.");
  return m;
}

/** Données d'un Moment pour pré-remplir le formulaire d'édition (hôte uniquement). */
export async function getMomentForEdit(viewerIn: Viewer | null, id: string) {
  const viewer = requireActive(viewerIn);
  const m = await loadOwnMoment(viewer, id);
  return {
    id: m.id,
    status: m.status,
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
    address: m.address,
    addressMembersOnly: m.addressMembersOnly,
    startsAtLocal: utcToZonedLocal(m.startsAt, m.timezone),
    endsAtLocal: m.endsAt ? utcToZonedLocal(m.endsAt, m.timezone) : "",
    timezone: m.timezone,
    capacity: m.capacity,
    visibility: m.visibility,
    showAttendees: m.showAttendees,
  };
}

export async function updateMoment(viewerIn: Viewer | null, id: string, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const input = momentInputSchema.parse(raw);
  const data = toMomentData(input, viewer);

  const replacedMedia: string[] = [];
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Moment" WHERE id = ${id} FOR UPDATE`;
    const m = await tx.moment.findUnique({ where: { id } });
    if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
    if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Seul l'hôte peut modifier ce Moment.");
    if (m.status === "CANCELLED") throw new AppError("MOMENT_NOT_OPEN", "Un Moment annulé ne peut plus être modifié.");
    if (momentPhase(m) === "ended") throw new AppError("MOMENT_NOT_OPEN", "Ce Moment est terminé.");

    const accepted = await tx.momentMembership.count({ where: { momentId: id, status: "ACCEPTED" } });
    if (data.capacity < accepted) {
      throw new AppError("VALIDATION", `${accepted} places sont déjà confirmées : la capacité ne peut pas descendre en dessous.`, {
        capacity: `Minimum ${accepted}.`,
      });
    }
    const publishNow = input.publish && m.status === "DRAFT";
    if ((publishNow || m.status === "PUBLISHED") && data.startsAt < new Date() && data.startsAt.getTime() !== m.startsAt.getTime()) {
      throw new AppError("VALIDATION", "Choisis une date à venir.", { startsAtLocal: "Choisis une date à venir." });
    }
    const updated = await tx.moment.update({
      where: { id },
      data: {
        ...data,
        ...(publishNow ? { status: "PUBLISHED", publishedAt: new Date() } : {}),
      },
    });

    // Prévenir les participants confirmés d'un changement d'horaire ou de lieu.
    const changedKeyInfo =
      m.status === "PUBLISHED" &&
      (m.startsAt.getTime() !== updated.startsAt.getTime() ||
        m.address !== updated.address ||
        m.placeName !== updated.placeName ||
        m.city !== updated.city);
    if (changedKeyInfo) {
      const members = await tx.momentMembership.findMany({
        where: { momentId: id, status: { in: ["ACCEPTED", "PENDING"] } },
        select: { userId: true },
      });
      await notifyMany(
        tx,
        members.map((x) => x.userId),
        { type: "MOMENT_UPDATED", momentId: id, actorId: viewer.id, body: `L'horaire ou le lieu de « ${updated.title} » a changé.` },
      );
    }
    if (m.mediaUrl && m.mediaUrl !== updated.mediaUrl) replacedMedia.push(m.mediaUrl);
    if (m.posterUrl && m.posterUrl !== updated.posterUrl) replacedMedia.push(m.posterUrl);
    return { id: updated.id, status: updated.status };
  });
  // Après validation de la transaction seulement : l'ancien visuel n'est plus référencé.
  for (const url of replacedMedia) await deleteStoredFile(url);
  return result;
}

export async function publishMoment(viewerIn: Viewer | null, id: string) {
  const viewer = requireVerified(viewerIn);
  const m = await loadOwnMoment(viewer, id);
  if (m.status !== "DRAFT") throw new AppError("CONFLICT", "Ce Moment est déjà publié ou annulé.");
  if (m.startsAt < new Date()) throw new AppError("VALIDATION", "La date de ce brouillon est passée : modifie-la avant de publier.");
  await prisma.moment.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
  return { id, status: "PUBLISHED" as const };
}

/** Annulation par l'hôte : demandes en attente annulées, participants et invités prévenus. */
export async function cancelMoment(viewerIn: Viewer | null, id: string, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const { reason } = cancelMomentSchema.parse(raw ?? {});
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Moment" WHERE id = ${id} FOR UPDATE`;
    const m = await tx.moment.findUnique({ where: { id } });
    if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
    if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Seul l'hôte peut annuler ce Moment.");
    if (m.status === "CANCELLED") throw new AppError("CONFLICT", "Ce Moment est déjà annulé.");
    if (momentEnd(m.startsAt, m.endsAt) < new Date()) throw new AppError("MOMENT_NOT_OPEN", "Ce Moment est terminé.");

    const toNotify = await tx.momentMembership.findMany({
      where: { momentId: id, status: { in: ["ACCEPTED", "PENDING"] } },
      select: { userId: true },
    });
    await tx.momentMembership.updateMany({
      where: { momentId: id, status: "PENDING" },
      data: { status: "CANCELLED", respondedAt: new Date() },
    });
    await tx.moment.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason || null },
    });
    await notifyMany(
      tx,
      toNotify.map((x) => x.userId),
      {
        type: "MOMENT_CANCELLED",
        momentId: id,
        actorId: viewer.id,
        body: `« ${m.title} » a été annulé par l'hôte.${reason ? ` Motif : ${reason}` : ""}`,
      },
    );
    return { id, status: "CANCELLED" as const };
  });
}

// ——— Listes pour le profil ———

export async function hostedMoments(viewer: Viewer | null, hostId: string): Promise<MomentCardDTO[]> {
  const isSelf = viewer?.id === hostId;
  const rows = await prisma.moment.findMany({
    where: {
      hostId,
      ...(isSelf ? {} : { status: "PUBLISHED", visibility: { in: ["PUBLIC", "REQUEST"] }, ...(canSeeAdult(viewer) ? {} : { isAdult: false }) }),
    },
    include: cardInclude,
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  return toCards(rows, viewer?.id ?? null);
}

/** Moments auxquels une personne a participé (place confirmée). */
export async function attendedMoments(viewer: Viewer | null, userId: string): Promise<MomentCardDTO[]> {
  const isSelf = viewer?.id === userId;
  const rows = await prisma.moment.findMany({
    where: {
      memberships: { some: { userId, status: "ACCEPTED", ...(isSelf ? {} : { showOnMoment: true }) } },
      // Participation à un Moment adulte : jamais montrée sur le profil aux autres.
      ...(isSelf ? {} : { status: "PUBLISHED", visibility: { in: ["PUBLIC", "REQUEST"] }, isAdult: false }),
    },
    include: cardInclude,
    orderBy: { startsAt: "desc" },
    take: 50,
  });
  return toCards(rows, viewer?.id ?? null);
}

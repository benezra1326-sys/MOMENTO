import type { Availability, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, requireCertified, type Viewer } from "@/lib/auth";
import { ADULT_CATEGORY, availabilitySlots, productConfig } from "@/config/product";
import { availabilityInputSchema, availabilityQuerySchema, availabilityUpdateSchema } from "@/lib/validation";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { blockedUserIds, isBlockedBetween } from "./safety";
import { personSelect, toPerson } from "./mappers";
import { canSeeAdult, whenRange } from "./moments";
import { approxLocation, boundingBox, haversineKm, parseNear } from "@/lib/geo";
import { tierLimits, tierOf, type Tier } from "@/lib/premium";
import { currentTier } from "./billing";
import type { PersonSummary } from "./types";

/**
 * Disponibilités : une personne dit volontairement « je suis libre tel jour, tel créneau, dans telle ville ».
 * Les autres membres connectés les parcourent et peuvent, s'ils en ont envie, créer un Moment et y
 * inviter la personne. Rien n'est envoyé automatiquement ; la disponibilité expire à la fin du créneau.
 * Confidentialité : jamais d'adresse, seulement ville et quartier ; blocages respectés dans les deux sens.
 */

export type AvailabilityDTO = {
  id: string;
  person: PersonSummary & { city: string };
  startsAt: string;
  endsAt: string;
  timezone: string;
  /** Jour local et créneau, pour pré-remplir un formulaire. */
  date: string;
  slot: string;
  /** Plage horaire locale « HH:MM ». */
  startTime: string;
  endTime: string;
  city: string;
  area: string;
  categories: string[];
  note: string;
  hidden: boolean;
  isAdult: boolean;
  isDemo: boolean;
  isMine: boolean;
  /** Distance depuis la position de la personne qui regarde (filtre « Autour de moi »). */
  distanceKm?: number | null;
};

/** Copie figée d'une dispo, gardée sur l'invitation pour toujours savoir pourquoi on s'est contacté. */
export type DispoSnapshot = {
  availabilityId: string;
  note: string;
  city: string;
  area: string;
  categories: string[];
  startsAt: string;
  endsAt: string;
  timezone: string;
};

export function toDispoSnapshot(a: AvailabilityDTO): DispoSnapshot {
  return { availabilityId: a.id, note: a.note, city: a.city, area: a.area, categories: a.categories, startsAt: a.startsAt, endsAt: a.endsAt, timezone: a.timezone };
}

export function parseDispoSnapshot(v: unknown): DispoSnapshot | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.startsAt !== "string" || typeof o.endsAt !== "string") return null;
  return {
    availabilityId: String(o.availabilityId ?? ""),
    note: typeof o.note === "string" ? o.note : "",
    city: typeof o.city === "string" ? o.city : "",
    area: typeof o.area === "string" ? o.area : "",
    categories: Array.isArray(o.categories) ? o.categories.filter((c): c is string => typeof c === "string") : [],
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    timezone: typeof o.timezone === "string" ? o.timezone : "Europe/Madrid",
  };
}

type Row = Availability & { user: PersonSummary & { city: string } };

const userSelect = { ...personSelect, city: true, premiumUntil: true, premiumPlan: true } as const;

/** Créneau d'une disponibilité : retrouve l'identifiant à partir des heures locales. */
function slotOf(a: Pick<Availability, "startsAt" | "endsAt" | "timezone">): string {
  const s = utcToZonedLocal(a.startsAt, a.timezone).slice(11, 16);
  const e = utcToZonedLocal(a.endsAt, a.timezone).slice(11, 16);
  return availabilitySlots.find((x) => x.start === s && x.end === e)?.id ?? "custom";
}

export function toAvailabilityDTO(a: Row, viewerId: string | null): AvailabilityDTO {
  return {
    id: a.id,
    person: { ...toPerson(a.user), city: a.user.city },
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    timezone: a.timezone,
    date: utcToZonedLocal(a.startsAt, a.timezone).slice(0, 10),
    slot: slotOf(a),
    startTime: utcToZonedLocal(a.startsAt, a.timezone).slice(11, 16),
    endTime: utcToZonedLocal(a.endsAt, a.timezone).slice(11, 16),
    city: a.city,
    area: a.area,
    categories: a.categories,
    note: a.note,
    hidden: a.hidden,
    isAdult: a.isAdult,
    isDemo: a.isDemo,
    isMine: a.userId === viewerId,
  };
}

/** Calcule début et fin (UTC) d'un créneau, et vérifie qu'il est dans la fenêtre autorisée. */
export function slotRange(date: string, slotId: string, tz: string, now = new Date()) {
  const slot = availabilitySlots.find((s) => s.id === slotId);
  if (!slot) throw new AppError("VALIDATION", "Choisis un créneau.", { slot: "Choisis un créneau." });
  const startsAt = zonedLocalToUtc(`${date}T${slot.start}`, tz);
  const endsAt = zonedLocalToUtc(`${date}T${slot.end}`, tz);
  if (Number.isNaN(startsAt.getTime())) throw new AppError("VALIDATION", "Jour invalide.", { date: "Jour invalide." });
  if (endsAt <= now) {
    throw new AppError("VALIDATION", "Ce créneau est déjà passé.", { slot: "Ce créneau est déjà passé." });
  }
  const max = now.getTime() + productConfig.limits.availabilityDaysAhead * 86400_000;
  if (startsAt.getTime() > max) {
    const msg = `${productConfig.limits.availabilityDaysAhead} jours à l'avance maximum.`;
    throw new AppError("VALIDATION", msg, { date: msg });
  }
  return { startsAt, endsAt };
}

/** Plage libre « de 18:00 à 21:00 ». Une fin avant le début passe au lendemain (ex. 22:00 → 02:00). */
export function timeRange(date: string, start: string, end: string, tz: string, now = new Date()) {
  const startsAt = zonedLocalToUtc(`${date}T${start}`, tz);
  let endsAt = zonedLocalToUtc(`${date}T${end}`, tz);
  if (Number.isNaN(startsAt.getTime())) throw new AppError("VALIDATION", "Jour invalide.", { date: "Jour invalide." });
  if (endsAt <= startsAt) {
    const next = utcToZonedLocal(new Date(zonedLocalToUtc(`${date}T12:00`, tz).getTime() + 86400_000), tz).slice(0, 10);
    endsAt = zonedLocalToUtc(`${next}T${end}`, tz);
  }
  const minutes = (endsAt.getTime() - startsAt.getTime()) / 60000;
  if (minutes < 30) throw new AppError("VALIDATION", "30 minutes minimum.", { endTime: "30 minutes minimum." });
  if (minutes > 16 * 60) throw new AppError("VALIDATION", "16 heures maximum.", { endTime: "16 heures maximum." });
  if (endsAt <= now) throw new AppError("VALIDATION", "Cette plage est déjà passée.", { endTime: "Cette plage est déjà passée." });
  const max = now.getTime() + productConfig.limits.availabilityDaysAhead * 86400_000;
  if (startsAt.getTime() > max) {
    const msg = `${productConfig.limits.availabilityDaysAhead} jours à l'avance maximum.`;
    throw new AppError("VALIDATION", msg, { date: msg });
  }
  return { startsAt, endsAt };
}

/** Début et fin d'une dispo : la plage libre si elle est donnée, sinon le créneau. */
function rangeOf(date: string, input: { slot?: string; startTime?: string; endTime?: string }, tz: string) {
  if (input.startTime && input.endTime) return timeRange(date, input.startTime, input.endTime, tz);
  if (input.startTime || input.endTime) throw new AppError("VALIDATION", "Indique l'heure de début et de fin.", { endTime: "Indique l'heure de début et de fin." });
  if (!input.slot) throw new AppError("VALIDATION", "Choisis un créneau.", { slot: "Choisis un créneau." });
  return slotRange(date, input.slot, tz);
}

/** Heures locales (en minutes depuis minuit du jour de début) d'un créneau de la journée. */
const daySlots: Record<string, [number, number]> = { morning: [9 * 60, 12 * 60], lunch: [12 * 60, 15 * 60], afternoon: [15 * 60, 19 * 60], evening: [19 * 60, 30 * 60] };

function overlapsSlot(a: Pick<Availability, "startsAt" | "endsAt" | "timezone">, slot: string) {
  const [s0, s1] = daySlots[slot];
  const local = utcToZonedLocal(a.startsAt, a.timezone);
  const start = Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16));
  const end = start + (a.endsAt.getTime() - a.startsAt.getTime()) / 60000;
  return start < s1 && end > s0;
}

/** Liste des disponibilités à venir des autres membres (et les miennes, signalées). */
export async function listAvailabilities(viewerIn: Viewer | null, rawQuery: unknown): Promise<AvailabilityDTO[]> {
  const viewer = requireActive(viewerIn);
  const q = availabilityQuerySchema.parse(rawQuery ?? {});
  const now = new Date();
  const blocked = await blockedUserIds(viewer.id);
  const range = whenRange(q.when, now);
  const where: Prisma.AvailabilityWhereInput = {
    hidden: false,
    endsAt: { gt: range ? (range.gte > now ? range.gte : now) : now },
    ...(range ? { startsAt: { lt: range.lt } } : {}),
    user: { status: "ACTIVE" },
    ...(canSeeAdult(viewer) ? {} : { isAdult: false }),
    ...(blocked.length ? { userId: { notIn: blocked } } : {}),
    ...(q.city ? { city: { equals: q.city, mode: "insensitive" } } : {}),
  };
  const near = parseNear(q.near);
  const km = q.km ?? 5;
  if (near) Object.assign(where, boundingBox(near, km));
  const rows = await prisma.availability.findMany({
    where,
    include: { user: { select: userSelect } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 200,
  });
  // Un membre revenu à une offre inférieure qui n'a pas encore choisi : on ne montre que ce que son offre permet.
  const shown = new Map<string, number>();
  const withinPlan = (r: (typeof rows)[number]) => {
    const n = (shown.get(r.userId) ?? 0) + 1;
    shown.set(r.userId, n);
    return n <= tierLimits[tierOf(r.user)].activeAvailabilities;
  };
  return rows
    .filter(withinPlan)
    .filter((r) => !q.slot || overlapsSlot(r, q.slot))
    .map((r) => {
      const d = near && r.lat !== null && r.lng !== null ? haversineKm(near, { lat: r.lat, lng: r.lng }) : null;
      return { r, d };
    })
    .filter((x) => !near || (x.d !== null && x.d <= km))
    .slice(0, 60)
    .map(({ r, d }) => ({ ...toAvailabilityDTO(r, viewer.id), distanceKm: d === null ? null : Math.round(d * 10) / 10 }));
}

/** Mes disponibilités encore utiles (masquées comprises). */
export async function myAvailabilities(viewerIn: Viewer | null): Promise<AvailabilityDTO[]> {
  const viewer = requireActive(viewerIn);
  await enforceAvailabilityLimit(viewer.id, await currentTier(viewer));
  const rows = await prisma.availability.findMany({
    where: { userId: viewer.id, endsAt: { gt: new Date() } },
    include: { user: { select: userSelect } },
    orderBy: { startsAt: "asc" },
  });
  return rows.map((r) => toAvailabilityDTO(r, viewer.id));
}

/** Une disponibilité visible par le viewer (pour pré-remplir « Proposer un Moment »). */
export async function getAvailability(viewerIn: Viewer | null, id: string): Promise<AvailabilityDTO> {
  const viewer = requireActive(viewerIn);
  const a = await prisma.availability.findUnique({ where: { id }, include: { user: { select: { ...userSelect, status: true } } } });
  const notFound = new AppError("NOT_FOUND", "Cette disponibilité n'existe plus.");
  if (!a) throw notFound;
  if (a.userId !== viewer.id) {
    if (a.hidden || a.endsAt <= new Date() || a.user.status !== "ACTIVE") throw notFound;
    if (await isBlockedBetween(viewer.id, a.userId)) throw notFound;
    if (a.isAdult && !canSeeAdult(viewer)) throw notFound;
  }
  return toAvailabilityDTO(a, viewer.id);
}

export async function createAvailability(viewerIn: Viewer | null, raw: unknown) {
  const viewer = requireCertified(viewerIn);
  const input = availabilityInputSchema.parse(raw ?? {});
  const { startsAt, endsAt } = rangeOf(input.date, input, input.timezone);
  const pos = approxLocation(input.city, input.area);
  const isAdult = input.categories.includes(ADULT_CATEGORY);
  if (isAdult && !canSeeAdult(viewer)) {
    throw new AppError("ADULT_ONLY", "Active « Afficher les Moments 18+ » dans ton profil pour publier ce type d'envie.");
  }
  const now = new Date();
  const today = await prisma.availability.count({ where: { userId: viewer.id, createdAt: { gt: new Date(now.getTime() - 86400_000) } } });
  if (today >= productConfig.limits.availabilitiesPerDay) {
    throw new AppError("RATE_LIMITED", "Trop de disponibilités publiées aujourd'hui. Réessaie demain.");
  }
  const tier = await currentTier(viewer);
  const cap = tierLimits[tier].activeAvailabilities;
  // Verrou sur le membre : deux publications simultanées ne peuvent pas dépasser la limite de l'offre.
  const a = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${viewer.id} FOR UPDATE`;
    if (input.replaceId) {
      const old = await tx.availability.findUnique({ where: { id: input.replaceId } });
      if (!old || old.userId !== viewer.id) throw new AppError("NOT_FOUND", "La dispo à remplacer n'existe plus.");
      await tx.availability.delete({ where: { id: old.id } });
    }
    const dup = await tx.availability.findFirst({ where: { userId: viewer.id, startsAt, endsAt } });
    if (dup) throw new AppError("CONFLICT", "Tu as déjà publié ce créneau.");
    const active = await tx.availability.findMany({ where: activeWhere(viewer.id, new Date()), orderBy: { startsAt: "asc" }, select: { id: true } });
    if (active.length >= cap) throw limitError(tier, cap, active[0].id);
    return tx.availability.create({
      data: {
        userId: viewer.id,
        startsAt,
        endsAt,
        timezone: input.timezone,
        city: input.city,
        area: input.area,
        lat: pos?.lat ?? null,
        lng: pos?.lng ?? null,
        categories: [...new Set(input.categories)],
        note: input.note,
        isAdult,
        isDemo: viewer.isDemo,
      },
      include: { user: { select: userSelect } },
    });
  });
  return toAvailabilityDTO(a, viewer.id);
}

/** Dispos actives : visibles et pas encore terminées. Une dispo expirée ou masquée ne compte jamais. */
function activeWhere(userId: string, now: Date): Prisma.AvailabilityWhereInput {
  return { userId, hidden: false, endsAt: { gt: now } };
}

function limitError(tier: Tier, cap: number, activeId: string) {
  const msg =
    tier === "free"
      ? "Avec l'offre gratuite, tu peux avoir une dispo active à la fois. Modifie celle que tu as, remplace-la par la nouvelle, ou découvre Upclose+ pour en avoir jusqu'à 5."
      : `Tu as déjà ${cap} dispos actives, le maximum. Modifie ou supprime-en une pour en ajouter.`;
  return new AppError("AVAILABILITY_LIMIT", msg, { activeId, tier });
}

/**
 * Après un retour à une offre inférieure : seules les dispos permises restent actives (les plus proches),
 * les autres passent en brouillon (masquées, jamais supprimées). Le membre peut ensuite choisir laquelle garder.
 */
export async function enforceAvailabilityLimit(userId: string, tier: Tier) {
  const cap = tierLimits[tier].activeAvailabilities;
  const active = await prisma.availability.findMany({ where: activeWhere(userId, new Date()), orderBy: { startsAt: "asc" }, select: { id: true } });
  const extra = active.slice(cap).map((a) => a.id);
  if (extra.length) await prisma.availability.updateMany({ where: { id: { in: extra } }, data: { hidden: true } });
  return extra.length;
}

async function ownAvailability(viewer: Viewer, id: string) {
  const a = await prisma.availability.findUnique({ where: { id } });
  if (!a || a.userId !== viewer.id) throw new AppError("NOT_FOUND", "Cette disponibilité n'existe plus.");
  return a;
}

/** Modifier, masquer ou réafficher sa disponibilité. */
export async function updateAvailability(viewerIn: Viewer | null, id: string, raw: unknown) {
  const viewer = requireActive(viewerIn);
  const a = await ownAvailability(viewer, id);
  const input = availabilityUpdateSchema.parse(raw ?? {});
  const data: Prisma.AvailabilityUpdateInput = {};
  if (input.date !== undefined || input.slot !== undefined || input.startTime !== undefined || input.endTime !== undefined || input.timezone !== undefined) {
    const tz = input.timezone ?? a.timezone;
    const date = input.date ?? utcToZonedLocal(a.startsAt, a.timezone).slice(0, 10);
    const custom = input.startTime !== undefined || input.endTime !== undefined;
    const range = custom
      ? rangeOf(date, { startTime: input.startTime, endTime: input.endTime }, tz)
      : input.slot
        ? slotRange(date, input.slot, tz)
        : timeRange(date, utcToZonedLocal(a.startsAt, a.timezone).slice(11, 16), utcToZonedLocal(a.endsAt, a.timezone).slice(11, 16), tz);
    Object.assign(data, range, { timezone: tz });
  }
  if (input.city !== undefined) data.city = input.city;
  if (input.area !== undefined) data.area = input.area;
  if (input.city !== undefined || input.area !== undefined) {
    const pos = approxLocation(input.city ?? a.city, input.area ?? a.area);
    data.lat = pos?.lat ?? null;
    data.lng = pos?.lng ?? null;
  }
  if (input.categories !== undefined) {
    const isAdult = input.categories.includes(ADULT_CATEGORY);
    if (isAdult && !canSeeAdult(viewer)) throw new AppError("ADULT_ONLY", "Active « Afficher les Moments 18+ » dans ton profil.");
    data.categories = [...new Set(input.categories)];
    data.isAdult = isAdult;
  }
  if (input.note !== undefined) data.note = input.note;
  if (input.hidden !== undefined) data.hidden = input.hidden;
  // Réactiver une dispo masquée (brouillon) : dans la limite de l'offre, ou à la place d'une autre (qui passe en brouillon).
  const reactivating = input.hidden === false && a.hidden;
  const tier = reactivating ? await currentTier(viewer) : null;
  const updated = await prisma.$transaction(async (tx) => {
    if (reactivating && tier) {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${viewer.id} FOR UPDATE`;
      if (input.replaceId) {
        const other = await tx.availability.findUnique({ where: { id: input.replaceId } });
        if (!other || other.userId !== viewer.id) throw new AppError("NOT_FOUND", "Cette disponibilité n'existe plus.");
        await tx.availability.update({ where: { id: other.id }, data: { hidden: true } });
      }
      const cap = tierLimits[tier].activeAvailabilities;
      const active = await tx.availability.findMany({ where: { ...activeWhere(viewer.id, new Date()), id: { not: id } }, orderBy: { startsAt: "asc" }, select: { id: true } });
      if (active.length >= cap) throw limitError(tier, cap, active[0].id);
    }
    return tx.availability.update({ where: { id }, data, include: { user: { select: userSelect } } });
  });
  return toAvailabilityDTO(updated, viewer.id);
}

export async function deleteAvailability(viewerIn: Viewer | null, id: string) {
  const viewer = requireActive(viewerIn);
  await ownAvailability(viewer, id);
  await prisma.availability.delete({ where: { id } });
  return { deleted: true };
}

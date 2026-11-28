import type { Availability, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { ADULT_CATEGORY, availabilitySlots, productConfig } from "@/config/product";
import { availabilityInputSchema, availabilityQuerySchema, availabilityUpdateSchema } from "@/lib/validation";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { blockedUserIds, isBlockedBetween } from "./safety";
import { personSelect, toPerson } from "./mappers";
import { canSeeAdult, whenRange } from "./moments";
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
  city: string;
  area: string;
  categories: string[];
  note: string;
  hidden: boolean;
  isAdult: boolean;
  isDemo: boolean;
  isMine: boolean;
};

type Row = Availability & { user: PersonSummary & { city: string } };

const userSelect = { ...personSelect, city: true } as const;

/** Créneau d'une disponibilité : retrouve l'identifiant à partir des heures locales. */
function slotOf(a: Pick<Availability, "startsAt" | "endsAt" | "timezone">): string {
  const s = utcToZonedLocal(a.startsAt, a.timezone).slice(11, 16);
  const e = utcToZonedLocal(a.endsAt, a.timezone).slice(11, 16);
  return availabilitySlots.find((x) => x.start === s && x.end === e)?.id ?? "day";
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
  const rows = await prisma.availability.findMany({
    where,
    include: { user: { select: userSelect } },
    orderBy: [{ startsAt: "asc" }, { id: "asc" }],
    take: 60,
  });
  return rows.map((r) => toAvailabilityDTO(r, viewer.id));
}

/** Mes disponibilités encore utiles (masquées comprises). */
export async function myAvailabilities(viewerIn: Viewer | null): Promise<AvailabilityDTO[]> {
  const viewer = requireActive(viewerIn);
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
  const viewer = requireActive(viewerIn);
  const input = availabilityInputSchema.parse(raw ?? {});
  const { startsAt, endsAt } = slotRange(input.date, input.slot, input.timezone);
  const isAdult = input.categories.includes(ADULT_CATEGORY);
  if (isAdult && !canSeeAdult(viewer)) {
    throw new AppError("ADULT_ONLY", "Active « Afficher les Moments 18+ » dans ton profil pour publier ce type d'envie.");
  }
  const now = new Date();
  const active = await prisma.availability.count({ where: { userId: viewer.id, endsAt: { gt: now } } });
  if (active >= productConfig.limits.availabilitiesActiveMax) {
    throw new AppError(
      "RATE_LIMITED",
      `${productConfig.limits.availabilitiesActiveMax} disponibilités à la fois maximum. Supprime-en une pour en ajouter.`,
    );
  }
  const today = await prisma.availability.count({ where: { userId: viewer.id, createdAt: { gt: new Date(now.getTime() - 86400_000) } } });
  if (today >= productConfig.limits.availabilitiesPerDay) {
    throw new AppError("RATE_LIMITED", "Trop de disponibilités publiées aujourd'hui. Réessaie demain.");
  }
  const dup = await prisma.availability.findFirst({ where: { userId: viewer.id, startsAt, endsAt } });
  if (dup) throw new AppError("CONFLICT", "Tu as déjà publié ce créneau.");
  const a = await prisma.availability.create({
    data: {
      userId: viewer.id,
      startsAt,
      endsAt,
      timezone: input.timezone,
      city: input.city,
      area: input.area,
      categories: [...new Set(input.categories)],
      note: input.note,
      isAdult,
      isDemo: viewer.isDemo,
    },
    include: { user: { select: userSelect } },
  });
  return toAvailabilityDTO(a, viewer.id);
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
  if (input.date !== undefined || input.slot !== undefined || input.timezone !== undefined) {
    const tz = input.timezone ?? a.timezone;
    const date = input.date ?? utcToZonedLocal(a.startsAt, a.timezone).slice(0, 10);
    const slot = input.slot ?? slotOf(a);
    Object.assign(data, slotRange(date, slot, tz), { timezone: tz });
  }
  if (input.city !== undefined) data.city = input.city;
  if (input.area !== undefined) data.area = input.area;
  if (input.categories !== undefined) {
    const isAdult = input.categories.includes(ADULT_CATEGORY);
    if (isAdult && !canSeeAdult(viewer)) throw new AppError("ADULT_ONLY", "Active « Afficher les Moments 18+ » dans ton profil.");
    data.categories = [...new Set(input.categories)];
    data.isAdult = isAdult;
  }
  if (input.note !== undefined) data.note = input.note;
  if (input.hidden !== undefined) data.hidden = input.hidden;
  const updated = await prisma.availability.update({ where: { id }, data, include: { user: { select: userSelect } } });
  return toAvailabilityDTO(updated, viewer.id);
}

export async function deleteAvailability(viewerIn: Viewer | null, id: string) {
  const viewer = requireActive(viewerIn);
  await ownAvailability(viewer, id);
  await prisma.availability.delete({ where: { id } });
  return { deleted: true };
}

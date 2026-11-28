import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { momentEnd } from "@/lib/time";
import { blockedUserIds } from "./safety";
import { personSelect, toPerson } from "./mappers";
import { requireCircle } from "./participation";
import type { PersonSummary } from "./types";

/**
 * Notes après un Moment vécu.
 * - Seules les personnes présentes (hôte et participants confirmés) se notent entre elles.
 * - Les notes sont privées et définitives : personne ne sait qui a noté quoi (pas de représailles).
 * - Une moyenne n'est affichée, et n'agit sur le classement, qu'à partir de `ratingMinCount` avis.
 * - Le classement n'utilise que ces notes : jamais l'âge, l'orientation ou la communauté.
 */

export const ratingCriteria = [
  { id: "punctuality", label: "Ponctualité", hostOnly: false },
  { id: "ambiance", label: "Ambiance", hostOnly: false },
  { id: "respect", label: "Respect", hostOnly: false },
  { id: "organisation", label: "Organisation", hostOnly: true },
  { id: "accuracy", label: "Fidèle à l'annonce", hostOnly: true },
] as const;

const score = z.coerce.number().int().min(1).max(5);

const ratingsSchema = z.object({
  ratings: z
    .array(
      z.object({
        userId: z.string().min(1),
        noShow: z.boolean().default(false),
        punctuality: score.optional(),
        ambiance: score.optional(),
        respect: score.optional(),
        organisation: score.optional(),
        accuracy: score.optional(),
        comment: z.string().trim().max(500).default(""),
      }),
    )
    .min(1, "Note au moins une personne.")
    .max(50),
});

export type RateTarget = PersonSummary & { isHost: boolean; alreadyRated: boolean };

function windowOpen(m: { startsAt: Date; endsAt: Date | null; status: string }, now = new Date()) {
  if (m.status !== "PUBLISHED") return false;
  const end = momentEnd(m.startsAt, m.endsAt);
  return end < now && now.getTime() - end.getTime() < productConfig.limits.ratingWindowDays * 86400_000;
}

/** Les personnes que le viewer peut encore noter pour ce Moment (vide si la fenêtre est fermée). */
export async function rateTargets(viewerIn: Viewer | null, momentId: string): Promise<{ open: boolean; targets: RateTarget[] }> {
  const viewer = requireActive(viewerIn);
  if (!productConfig.features.ratings) return { open: false, targets: [] };
  const { moment } = await requireCircle(viewer, momentId);
  if (!windowOpen(moment)) return { open: false, targets: [] };
  const blocked = new Set(await blockedUserIds(viewer.id));
  const [host, members, given] = [
    await prisma.user.findUnique({ where: { id: moment.hostId }, select: personSelect }),
    await prisma.momentMembership.findMany({ where: { momentId, status: "ACCEPTED" }, include: { user: { select: personSelect } } }),
    await prisma.rating.findMany({ where: { momentId, raterId: viewer.id }, select: { rateeId: true } }),
  ];
  const done = new Set(given.map((g) => g.rateeId));
  const people: RateTarget[] = [];
  if (host && host.id !== viewer.id) people.push({ ...toPerson(host), isHost: true, alreadyRated: done.has(host.id) });
  for (const m of members) {
    if (m.userId === viewer.id) continue;
    people.push({ ...toPerson(m.user), isHost: false, alreadyRated: done.has(m.userId) });
  }
  return { open: true, targets: people.filter((p) => !blocked.has(p.id)) };
}

export async function submitRatings(viewerIn: Viewer | null, momentId: string, raw: unknown) {
  const viewer = requireActive(viewerIn);
  if (!productConfig.features.ratings) throw new AppError("NOT_FOUND", "Les notes ne sont pas ouvertes.");
  const { moment } = await requireCircle(viewer, momentId);
  if (!windowOpen(moment)) throw new AppError("MOMENT_NOT_OPEN", `On peut noter pendant ${productConfig.limits.ratingWindowDays} jours après la fin du Moment.`);
  const { ratings } = ratingsSchema.parse(raw ?? {});
  const { targets } = await rateTargets(viewer, momentId);
  const allowed = new Map(targets.map((t) => [t.id, t]));
  let saved = 0;
  for (const r of ratings) {
    const target = allowed.get(r.userId);
    if (!target || target.alreadyRated) continue;
    if (!r.noShow && (!r.punctuality || !r.ambiance || !r.respect)) {
      throw new AppError("VALIDATION", `Donne une note sur chaque critère pour ${target.name}.`);
    }
    await prisma.rating.create({
      data: {
        momentId,
        raterId: viewer.id,
        rateeId: r.userId,
        rateeIsHost: target.isHost,
        noShow: r.noShow,
        // Une absence n'est pas une note : elle est comptée à part et n'entre pas dans les moyennes.
        punctuality: r.noShow ? 0 : r.punctuality!,
        ambiance: r.noShow ? 0 : r.ambiance!,
        respect: r.noShow ? 0 : r.respect!,
        organisation: !r.noShow && target.isHost ? r.organisation ?? null : null,
        accuracy: !r.noShow && target.isHost ? r.accuracy ?? null : null,
        comment: r.comment,
      },
    });
    saved++;
  }
  await prisma.notification.updateMany({ where: { userId: viewer.id, momentId, type: "RATE_MOMENT", readAt: null }, data: { readAt: new Date() } });
  return { saved };
}

export type Reputation = {
  /** Moyenne générale sur 5, null tant qu'il y a moins de `ratingMinCount` avis. */
  avg: number | null;
  count: number;
  /** Moyenne comme hôte (organisation, fidélité comprises). */
  hostAvg: number | null;
  hostCount: number;
  criteria: Record<string, number | null>;
  noShows: number;
  /** Badges positifs uniquement : on valorise, on n'affiche jamais de mauvais point. */
  badges: string[];
  /** Score de classement (moyenne bayésienne), neutre à 4 sans avis. */
  rankScore: number;
};

const PRIOR = 4;
const PRIOR_WEIGHT = 3;

/** Réputations agrégées de plusieurs personnes, en une requête. */
export async function reputations(userIds: string[]): Promise<Map<string, Reputation>> {
  const ids = [...new Set(userIds)];
  const out = new Map<string, Reputation>();
  if (!ids.length || !productConfig.features.ratings) return out;
  const rows = await prisma.rating.findMany({
    where: { rateeId: { in: ids } },
    select: { rateeId: true, rateeIsHost: true, noShow: true, punctuality: true, ambiance: true, respect: true, organisation: true, accuracy: true },
  });
  const min = productConfig.limits.ratingMinCount;
  for (const id of ids) {
    const mine = rows.filter((r) => r.rateeId === id);
    const real = mine.filter((r) => !r.noShow);
    const per = real.map((r) => {
      const vals = [r.punctuality, r.ambiance, r.respect, r.organisation, r.accuracy].filter((v): v is number => typeof v === "number" && v > 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const sum = per.reduce((a, b) => a + b, 0);
    const host = real.filter((r) => r.rateeIsHost);
    const hostPer = host.map((r) => {
      const vals = [r.punctuality, r.ambiance, r.respect, r.organisation, r.accuracy].filter((v): v is number => typeof v === "number" && v > 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    const crit = (k: "punctuality" | "ambiance" | "respect" | "organisation" | "accuracy") => {
      const vals = real.map((r) => r[k]).filter((v): v is number => typeof v === "number" && v > 0);
      return vals.length >= min ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    };
    const criteria = { punctuality: crit("punctuality"), ambiance: crit("ambiance"), respect: crit("respect"), organisation: crit("organisation"), accuracy: crit("accuracy") };
    const avg = per.length >= min ? Math.round((sum / per.length) * 10) / 10 : null;
    const hostAvg = hostPer.length >= min ? Math.round((hostPer.reduce((a, b) => a + b, 0) / hostPer.length) * 10) / 10 : null;
    const noShows = mine.length - real.length;
    const badges: string[] = [];
    if (hostAvg !== null && hostAvg >= 4.5) badges.push("Hôte apprécié");
    if (criteria.punctuality !== null && criteria.punctuality >= 4.6 && noShows === 0) badges.push("Toujours ponctuel");
    if (criteria.ambiance !== null && criteria.ambiance >= 4.6) badges.push("Bonne énergie");
    if (criteria.organisation !== null && criteria.organisation >= 4.6) badges.push("Excellent organisateur");
    if (real.length >= 10 && noShows === 0) badges.push("Très fiable");
    // Les absences pèsent dans le classement comme une note de 1.
    const rankScore = (PRIOR * PRIOR_WEIGHT + sum + noShows * 1) / (PRIOR_WEIGHT + per.length + noShows);
    out.set(id, { avg, count: per.length, hostAvg, hostCount: hostPer.length, criteria, noShows, badges, rankScore });
  }
  return out;
}

/** Moments vécus récemment qu'il reste à noter (pour l'onglet Activité). */
export async function momentsToRate(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  if (!productConfig.features.ratings) return [];
  const now = new Date();
  const since = new Date(now.getTime() - productConfig.limits.ratingWindowDays * 86400_000 - 12 * 3600_000);
  const moments = await prisma.moment.findMany({
    where: {
      status: "PUBLISHED",
      startsAt: { gt: since, lt: now },
      OR: [{ hostId: viewer.id }, { memberships: { some: { userId: viewer.id, status: "ACCEPTED" } } }],
    },
    select: { id: true, title: true, startsAt: true, endsAt: true, status: true },
    orderBy: { startsAt: "desc" },
    take: 8,
  });
  const out: { id: string; title: string; startsAt: string; left: number }[] = [];
  for (const m of moments) {
    if (!windowOpen(m, now)) continue;
    const { targets } = await rateTargets(viewer, m.id);
    const left = targets.filter((t) => !t.alreadyRated).length;
    if (left > 0) out.push({ id: m.id, title: m.title, startsAt: m.startsAt.toISOString(), left });
  }
  return out;
}

export type RatedMoment = {
  id: string;
  title: string;
  startsAt: string;
  timezone: string;
  city: string;
  mediaType: string;
  mediaUrl: string | null;
  textTheme: string | null;
  asHost: boolean;
  /** Nombre d'avis reçus sur ce Moment. */
  count: number;
  /** Moyenne sur ce Moment, seulement à partir de 2 avis : un avis seul resterait identifiable. */
  avg: number | null;
};

/**
 * Les Moments qui ont construit la note d'une personne (page « Avis » du profil).
 * On ne montre jamais qui a noté ni une note isolée ; les Moments 18+ restent cachés à qui n'y a pas accès,
 * et les Moments vécus comme invité suivent le réglage « afficher mes Moments passés ».
 */
export async function ratedMoments(
  viewer: Pick<Viewer, "id" | "showAdult" | "adultConfirmedAt"> | null,
  user: { id: string; showPastMoments: boolean },
): Promise<{ moments: RatedMoment[]; hidden: number }> {
  if (!productConfig.features.ratings) return { moments: [], hidden: 0 };
  const isSelf = viewer?.id === user.id;
  const adultOk = !!viewer && productConfig.features.adultSpace && !!viewer.showAdult && !!viewer.adultConfirmedAt;
  const rows = await prisma.rating.findMany({
    where: { rateeId: user.id, noShow: false },
    select: {
      momentId: true, rateeIsHost: true, punctuality: true, ambiance: true, respect: true, organisation: true, accuracy: true,
      moment: { select: { id: true, title: true, startsAt: true, timezone: true, city: true, mediaType: true, mediaUrl: true, textTheme: true, isAdult: true } },
    },
  });
  const by = new Map<string, typeof rows>();
  for (const r of rows) by.set(r.momentId, [...(by.get(r.momentId) ?? []), r]);
  const moments: RatedMoment[] = [];
  let hidden = 0;
  for (const list of by.values()) {
    const m = list[0].moment;
    const asHost = list[0].rateeIsHost;
    if ((m.isAdult && !adultOk && !isSelf) || (!asHost && !user.showPastMoments && !isSelf)) {
      hidden++;
      continue;
    }
    const per = list.map((r) => {
      const vals = [r.punctuality, r.ambiance, r.respect, r.organisation, r.accuracy].filter((v): v is number => typeof v === "number" && v > 0);
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    moments.push({
      id: m.id, title: m.title, startsAt: m.startsAt.toISOString(), timezone: m.timezone, city: m.city,
      mediaType: m.mediaType, mediaUrl: m.mediaUrl, textTheme: m.textTheme, asHost, count: list.length,
      avg: list.length >= 2 ? Math.round((per.reduce((a, b) => a + b, 0) / per.length) * 10) / 10 : null,
    });
  }
  moments.sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { moments, hidden };
}

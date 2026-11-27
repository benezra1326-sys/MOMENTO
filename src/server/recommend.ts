import type { Moment } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { Viewer } from "@/lib/auth";
import { categoryLabel } from "@/config/product";
import { reputations, type Reputation } from "./ratings";

/**
 * Classement « Pour toi » : explicable, sans boîte noire. Chaque point vient d'un signal lisible
 * (tu es dispo à ce moment-là, c'est dans tes envies, c'est près de toi, l'hôte est bien noté,
 * il reste peu de places réelles). Les signaux sont affichés sur la carte (« Pourquoi pour toi »).
 * Aucune donnée sensible (âge, orientation, communauté) n'entre dans le calcul.
 */

export type RankContext = {
  viewerId: string | null;
  city: string;
  interests: string[];
  envies: Set<string>;
  pastCategories: Set<string>;
  dispos: { startsAt: Date; endsAt: Date; categories: string[]; city: string }[];
  reps: Map<string, Reputation>;
};

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export async function rankContext(viewer: Viewer | null, hostIds: string[]): Promise<RankContext> {
  const reps = await reputations(hostIds);
  if (!viewer) return { viewerId: null, city: "", interests: [], envies: new Set(), pastCategories: new Set(), dispos: [], reps };
  // Requêtes séquentielles : une seule connexion à la base en production.
  const me = await prisma.user.findUnique({ where: { id: viewer.id }, select: { interests: true, city: true } });
  const dispos = await prisma.availability.findMany({
    where: { userId: viewer.id, hidden: false, endsAt: { gt: new Date() } },
    select: { startsAt: true, endsAt: true, categories: true, city: true },
  });
  const past = await prisma.momentMembership.findMany({
    where: { userId: viewer.id, status: "ACCEPTED" },
    select: { moment: { select: { category: true } } },
    take: 30,
    orderBy: { createdAt: "desc" },
  });
  return {
    viewerId: viewer.id,
    city: me?.city ?? viewer.city ?? "",
    interests: (me?.interests ?? []).map(norm),
    envies: new Set(dispos.flatMap((d) => d.categories)),
    pastCategories: new Set(past.map((p) => p.moment.category)),
    dispos,
    reps,
  };
}

export type Scored = { score: number; reasons: string[] };

export function scoreMoment(
  m: Pick<Moment, "id" | "hostId" | "category" | "vibeTags" | "city" | "startsAt" | "endsAt" | "capacity" | "publishedAt" | "createdAt">,
  accepted: number,
  ctx: RankContext,
  now = new Date(),
): Scored {
  let score = 0;
  const reasons: string[] = [];
  const end = m.endsAt ?? new Date(m.startsAt.getTime() + 3 * 3600_000);

  // 1. Tu as dit que tu étais libre à ce moment-là (le signal le plus fort : l'envie immédiate).
  const dispo = ctx.dispos.find((d) => d.startsAt < end && d.endsAt > m.startsAt);
  if (dispo) {
    score += 5;
    reasons.push("Tu es dispo à ce moment-là");
    if (dispo.categories.includes(m.category)) score += 2;
  }

  // 2. Dans tes envies ou tes centres d'intérêt.
  const label = norm(categoryLabel(m.category));
  const tagHit = m.vibeTags.some((t) => ctx.interests.includes(norm(t)));
  const interestHit = ctx.interests.some((i) => i.length > 2 && (label.includes(i) || i.includes(label.split(" ")[0])));
  if (ctx.envies.has(m.category) || interestHit || tagHit) {
    score += 2.5;
    reasons.push(`Dans tes envies : ${categoryLabel(m.category)}`);
  } else if (ctx.pastCategories.has(m.category)) {
    score += 1.2;
  }

  // 3. Près de toi.
  if (ctx.city && norm(m.city) === norm(ctx.city)) {
    score += 2;
    reasons.push("Près de toi");
  }

  // 4. Le timing : bientôt, sans écraser les Moments plus lointains.
  const hours = (m.startsAt.getTime() - now.getTime()) / 3600_000;
  if (hours < 0) score += 0.5;
  else if (hours <= 6) {
    score += 2.5;
    reasons.push("Ce soir ou très bientôt");
  } else if (hours <= 48) score += 1.6;
  else if (hours <= 7 * 24) score += 0.8;

  // 5. Rareté réelle : il reste vraiment peu de places.
  const left = m.capacity - accepted;
  if (left <= 0) score -= 6;
  else if (left <= 2) {
    score += 1;
    reasons.push(left === 1 ? "Dernière place" : `Plus que ${left} places`);
  }

  // 6. Réputation de l'hôte (moyenne bayésienne : sans avis, neutre ; mal noté, recule ; bien noté, monte).
  const rep = ctx.reps.get(m.hostId);
  if (rep) {
    score += (rep.rankScore - 4) * 2.5;
    const shown = rep.hostAvg ?? rep.avg;
    if (shown !== null && shown >= 4.5) reasons.push(`Hôte noté ${shown.toFixed(1).replace(".", ",")}/5`);
  }

  // 7. Nouveauté : un Moment publié récemment remonte un peu (rotation du feed).
  const age = (now.getTime() - (m.publishedAt ?? m.createdAt).getTime()) / 3600_000;
  if (age < 24) score += 0.8;

  return { score, reasons: reasons.slice(0, 3) };
}

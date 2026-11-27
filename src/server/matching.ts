import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { categoryLabel } from "@/config/product";
import { momentEnd } from "@/lib/time";
import { blockedUserIds } from "./safety";
import { personSelect, toPerson } from "./mappers";
import { reputations } from "./ratings";
import type { PersonSummary } from "./types";

/**
 * Matching pour l'hôte : parmi les personnes qui ont publié une dispo compatible avec son Moment
 * (même ville, créneau qui recoupe l'horaire), lesquelles inviter en priorité. Chaque suggestion dit
 * pourquoi. Rien n'est envoyé : l'hôte choisit qui inviter.
 * Équilibre du groupe : on évite de proposer uniquement des personnes au même profil d'envies, en
 * mélangeant les envies déjà présentes et les nouvelles (sans jamais utiliser âge, genre ou orientation).
 */

export type InviteeSuggestion = { person: PersonSummary; reasons: string[]; availabilityId: string; note: string };

export async function suggestInvitees(viewerIn: Viewer | null, momentId: string): Promise<InviteeSuggestion[]> {
  const viewer = requireActive(viewerIn);
  const m = await prisma.moment.findUnique({ where: { id: momentId } });
  if (!m) throw new AppError("NOT_FOUND", "Moment introuvable.");
  if (m.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Réservé à l'hôte.");
  if (m.status === "CANCELLED") return [];
  const end = momentEnd(m.startsAt, m.endsAt);
  if (end < new Date()) return [];

  const blocked = await blockedUserIds(viewer.id);
  const members = await prisma.momentMembership.findMany({ where: { momentId }, select: { userId: true } });
  const exclude = new Set([viewer.id, ...blocked, ...members.map((x) => x.userId)]);

  const rows = await prisma.availability.findMany({
    where: {
      hidden: false,
      startsAt: { lt: end },
      endsAt: { gt: m.startsAt },
      city: { equals: m.city, mode: "insensitive" },
      user: { status: "ACTIVE", ...(m.isAdult ? { showAdult: true, adultConfirmedAt: { not: null } } : {}) },
      ...(m.isAdult ? {} : { isAdult: false }),
    },
    include: { user: { select: { ...personSelect, interests: true } } },
    take: 60,
  });
  const candidates = rows.filter((r) => !exclude.has(r.userId));
  const reps = await reputations(candidates.map((c) => c.userId));
  const seen = new Set<string>();
  const scored = candidates
    .map((r) => {
      const reasons = ["Dispo à ce moment-là"];
      let score = 3;
      if (r.categories.includes(m.category)) {
        score += 3;
        reasons.push(`Envie de : ${categoryLabel(m.category)}`);
      }
      if (m.area && r.area && r.area.toLowerCase() === m.area.toLowerCase()) {
        score += 1;
        reasons.push(`Dans le quartier (${r.area})`);
      }
      const shared = m.vibeTags.filter((t) => r.user.interests.includes(t.toLowerCase()));
      if (shared.length) {
        score += 1;
        reasons.push(`Aime : ${shared.slice(0, 2).join(", ")}`);
      }
      const rep = reps.get(r.userId);
      if (rep) {
        score += (rep.rankScore - 4) * 2;
        if (rep.avg !== null && rep.avg >= 4.5) reasons.push(`Noté ${rep.avg.toFixed(1).replace(".", ",")}/5`);
      }
      return { r, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .filter((x) => (seen.has(x.r.userId) ? false : (seen.add(x.r.userId), true)));
  return scored.slice(0, 6).map(({ r, reasons }) => ({ person: toPerson(r.user), reasons: reasons.slice(0, 3), availabilityId: r.id, note: r.note }));
}

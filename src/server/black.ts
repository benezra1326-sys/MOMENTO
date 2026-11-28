import { prisma } from "@/lib/db";
import { requireActive, type Viewer } from "@/lib/auth";
import { categoryLabel } from "@/config/product";
import { blockedUserIds } from "./safety";
import { personSelect, toPerson } from "./mappers";
import { reputations } from "./ratings";
import { currentTier } from "./billing";
import type { PersonSummary } from "./types";

/**
 * Fonctions Upclose Black : qui a vu tes Moments et ton profil, et personnes suggérées.
 * Les visites sont comptées une fois par personne, cible et jour ; jamais celles de l'hôte sur son propre Moment.
 */
export async function recordView(viewer: Viewer | null, ownerId: string, target: string) {
  if (!viewer || viewer.id === ownerId) return;
  const day = new Date().toISOString().slice(0, 10);
  try {
    await prisma.profileView.createMany({ data: [{ viewerId: viewer.id, ownerId, target, day }], skipDuplicates: true });
  } catch {
    // Une visite non comptée ne doit jamais empêcher d'afficher la page.
  }
}

export type ViewRow = { person: PersonSummary; lastAt: string; profile: boolean; moments: { id: string; title: string }[] };

export async function myViews(viewerIn: Viewer | null): Promise<{ unlocked: boolean; people: number; rows: ViewRow[] }> {
  const viewer = requireActive(viewerIn);
  const since = new Date(Date.now() - 30 * 86400_000);
  const blocked = await blockedUserIds(viewer.id);
  const views = await prisma.profileView.findMany({
    where: { ownerId: viewer.id, createdAt: { gt: since }, viewer: { status: "ACTIVE" }, ...(blocked.length ? { viewerId: { notIn: blocked } } : {}) },
    include: { viewer: { select: personSelect } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const unlocked = (await currentTier(viewer)) === "black";
  const byPerson = new Map<string, ViewRow>();
  for (const v of views) {
    const row = byPerson.get(v.viewerId) ?? { person: toPerson(v.viewer), lastAt: v.createdAt.toISOString(), profile: false, moments: [] };
    if (v.target === "profile") row.profile = true;
    else if (!row.moments.some((m) => m.id === v.target)) row.moments.push({ id: v.target, title: "" });
    byPerson.set(v.viewerId, row);
  }
  if (!unlocked) return { unlocked, people: byPerson.size, rows: [] };
  const ids = [...new Set([...byPerson.values()].flatMap((r) => r.moments.map((m) => m.id)))];
  const titles = new Map((await prisma.moment.findMany({ where: { id: { in: ids } }, select: { id: true, title: true } })).map((m) => [m.id, m.title]));
  const rows = [...byPerson.values()].map((r) => ({ ...r, moments: r.moments.filter((m) => titles.has(m.id)).map((m) => ({ id: m.id, title: titles.get(m.id)! })) }));
  return { unlocked, people: rows.length, rows };
}

export type PersonSuggestion = { person: PersonSummary; city: string; reasons: string[] };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Personnes pour toi : mêmes envies, même ville, dispo bientôt, très bien notées. Jamais d'âge, de genre ni d'orientation. */
export async function suggestPeople(viewerIn: Viewer | null): Promise<{ unlocked: boolean; items: PersonSuggestion[] }> {
  const viewer = requireActive(viewerIn);
  if ((await currentTier(viewer)) !== "black") return { unlocked: false, items: [] };
  const me = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { city: true, interests: true } });
  const blocked = await blockedUserIds(viewer.id);
  // Personnes déjà croisées sur un Moment : on ne les propose pas, tu les connais déjà.
  const mine = await prisma.momentMembership.findMany({ where: { userId: viewer.id, status: "ACCEPTED" }, select: { momentId: true } });
  const met = await prisma.momentMembership.findMany({
    where: { momentId: { in: mine.map((m) => m.momentId) }, status: "ACCEPTED" },
    select: { userId: true },
  });
  const exclude = new Set([viewer.id, ...blocked, ...met.map((m) => m.userId)]);
  const candidates = await prisma.user.findMany({
    where: { status: "ACTIVE", id: { notIn: [...exclude] } },
    select: { ...personSelect, city: true, interests: true, availabilities: { where: { hidden: false, isAdult: false, endsAt: { gt: new Date() } }, select: { categories: true }, take: 3 } },
    take: 300,
  });
  const reps = await reputations(candidates.map((c) => c.id));
  const myInterests = new Set(me.interests.map(norm));
  const myCity = norm(me.city || viewer.city || "");
  const scored = candidates.map((c) => {
    let score = 0;
    const reasons: string[] = [];
    const shared = c.interests.filter((i) => myInterests.has(norm(i)));
    if (shared.length) {
      score += 2 * shared.length;
      reasons.push(`Vous aimez tous les deux : ${shared.slice(0, 2).join(", ")}`);
    }
    if (myCity && norm(c.city) === myCity) {
      score += 1.5;
      reasons.push(`À ${c.city} comme toi`);
    }
    if (c.availabilities.length) {
      score += 1;
      const cat = c.availabilities[0].categories[0];
      reasons.push(cat ? `Dispo bientôt pour : ${categoryLabel(cat)}` : "Dispo bientôt");
    }
    const rep = reps.get(c.id);
    const avg = rep ? rep.hostAvg ?? rep.avg : null;
    if (avg !== null && avg >= 4.5) {
      score += 1;
      reasons.push("Très bien noté·e après ses Moments");
    }
    return { c, score, reasons };
  });
  const items = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(({ c, reasons }) => ({ person: toPerson(c), city: c.city, reasons: reasons.slice(0, 3) }));
  return { unlocked: true, items };
}

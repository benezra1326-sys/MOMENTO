/**
 * Jeu de données de démonstration complet (profils, Moments, participations, notifications,
 * signalements), calculé à partir de demo-data.ts. Utilisé par prisma/seed.ts (base locale)
 * et par scripts/demo-sql.ts (SQL pour la base de production, via l'éditeur Supabase).
 *
 * Les dates sont relatives à `now` : le feed a toujours des Moments à venir.
 */
import type { MembershipKind, MembershipStatus, NotificationType } from "@prisma/client";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { DEMO_TZ, demoCover, demoPhoto, moments, people, type SeedMoment } from "./demo-data";

export type DemoUserRow = {
  email: string; username: string; name: string; city: string; bio: string; interests: string[];
  photoUrl: string | null; role: "USER" | "ADMIN"; createdAt: Date;
};
export type DemoMomentRow = {
  id: string; host: string; title: string; description: string; category: string; vibeTags: string[];
  mediaType: SeedMoment["media"]; mediaUrl: string | null; posterUrl: string | null; textTheme: string | null;
  city: string; area: string; placeName: string; address: string | null; startsAt: Date; endsAt: Date | null;
  capacity: number; status: "DRAFT" | "PUBLISHED" | "CANCELLED"; visibility: "PUBLIC" | "REQUEST" | "INVITE_ONLY" | "PRIVATE";
  publishedAt: Date | null; cancelledAt: Date | null; cancelReason: string | null; createdAt: Date;
};
export type DemoMembershipRow = {
  momentId: string; user: string; initiator: string; kind: MembershipKind; status: MembershipStatus;
  message: string | null; createdAt: Date; respondedAt: Date | null;
};
export type DemoNotificationRow = {
  user: string; type: NotificationType; momentId: string | null; actor: string | null; body: string; createdAt: Date; readAt: Date | null;
};
export type DemoReportRow = { reporter: string; targetUser: string | null; momentId: string | null; reason: string; details: string; createdAt: Date };

export const demoEmail = (slug: string) => `${slug}@demo.momento.app`;
export const demoMomentId = (key: string) => `dm_${key}`;

// Petit générateur pseudo-aléatoire déterministe (mêmes données à chaque seed).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

export function buildDemoDataset(now = new Date()) {
  const r = rng(4242);
  const H = 3600_000;
  const at = (dayOffset: number, hhmm: string) => {
    const d = new Date(now.getTime() + dayOffset * 86400_000);
    return zonedLocalToUtc(`${utcToZonedLocal(d, DEMO_TZ).slice(0, 10)}T${hhmm}`, DEMO_TZ);
  };
  const minDate = (a: Date, b: Date) => (a < b ? a : b);
  const between = (a: Date, b: Date) => new Date(a.getTime() + r() * Math.max(0, b.getTime() - a.getTime()));
  const nameOf = new Map(people.map((p) => [p.slug, p.name]));

  const users: DemoUserRow[] = people.map((p, i) => ({
    email: demoEmail(p.slug),
    username: p.slug,
    name: p.name,
    city: p.city,
    bio: p.bio,
    interests: p.interests,
    photoUrl: demoPhoto(p),
    role: p.admin ? "ADMIN" : "USER",
    createdAt: new Date(now.getTime() - (p.joinedDaysAgo ?? 150 - i) * 86400_000),
  }));

  const momentRows: DemoMomentRow[] = [];
  const memberships: DemoMembershipRow[] = [];
  const notifications: DemoNotificationRow[] = [];
  const notify = (n: Omit<DemoNotificationRow, "readAt">) => {
    if (n.createdAt > now) return;
    // Plus d'un jour : déjà lue. Sinon non lue (pastille dans la navigation).
    notifications.push({ ...n, readAt: now.getTime() - n.createdAt.getTime() > 26 * H ? new Date(n.createdAt.getTime() + 2 * H) : null });
  };

  for (const s of moments) {
    const id = demoMomentId(s.key!);
    const startsAt = at(s.day, s.start);
    let endsAt = s.end ? at(s.day, s.end) : null;
    if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400_000);
    const status = s.status ?? "PUBLISHED";
    const visibility = s.visibility ?? "REQUEST";
    // Publié 2 à 9 jours avant le début, jamais dans le futur.
    const createdAt = minDate(new Date(startsAt.getTime() - (2 + r() * 7) * 86400_000), new Date(now.getTime() - (2 + r() * 40) * H));
    const publishedAt = status === "DRAFT" ? null : new Date(createdAt.getTime() + 0.2 * H);
    const cancelledAt = status === "CANCELLED" ? minDate(new Date(now.getTime() - r() * 20 * H), startsAt) : null;
    momentRows.push({
      id, host: s.host, title: s.title, description: s.description, category: s.category, vibeTags: s.tags,
      mediaType: s.media, mediaUrl: demoCover(s), posterUrl: s.posterUrl ?? null, textTheme: s.textTheme ?? null,
      city: s.city, area: s.area, placeName: s.placeName, address: s.address ?? null, startsAt, endsAt,
      capacity: s.capacity, status, visibility, publishedAt, cancelledAt, cancelReason: s.cancelReason ?? null, createdAt,
    });
    if (!publishedAt) continue;
    const latest = minDate(now, new Date(startsAt.getTime() - 0.5 * H));
    const recent = s.day >= -4; // notifications seulement pour l'activité récente
    for (const [user, st, kind = "REQUEST", message] of s.members ?? []) {
      const mCreated = between(publishedAt, latest);
      const respondedAt = st === "PENDING" ? null : between(mCreated, latest);
      memberships.push({ momentId: id, user, initiator: kind === "INVITE" ? s.host : user, kind, status: st, message: message ?? null, createdAt: mCreated, respondedAt });
      if (!recent) continue;
      const host = nameOf.get(s.host)!;
      const who = nameOf.get(user)!;
      const t = `« ${s.title} »`;
      if (kind === "REQUEST") {
        notify({ user: s.host, type: "JOIN_REQUEST", momentId: id, actor: user, createdAt: mCreated, body: visibility === "PUBLIC" ? `${who} a rejoint ${t}.` : `${who} demande à rejoindre ${t}.` });
        if (st === "ACCEPTED" && visibility !== "PUBLIC") notify({ user, type: "REQUEST_ACCEPTED", momentId: id, actor: s.host, createdAt: respondedAt!, body: `Ta place pour ${t} est confirmée.` });
        if (st === "DECLINED") notify({ user, type: "REQUEST_DECLINED", momentId: id, actor: s.host, createdAt: respondedAt!, body: `L'hôte n'a pas pu accepter ta demande pour ${t}.` });
        if (st === "CANCELLED") notify({ user: s.host, type: "MEMBER_LEFT", momentId: id, actor: user, createdAt: respondedAt!, body: `${who} ne pourra plus venir à ${t}. Une place s'est libérée.` });
      } else {
        notify({ user, type: "INVITATION", momentId: id, actor: s.host, createdAt: mCreated, body: `${host} t'invite à ${t}.` });
        if (st === "ACCEPTED") notify({ user: s.host, type: "INVITATION_ACCEPTED", momentId: id, actor: user, createdAt: respondedAt!, body: `${who} a accepté ton invitation à ${t}.` });
        if (st === "DECLINED") notify({ user: s.host, type: "INVITATION_DECLINED", momentId: id, actor: user, createdAt: respondedAt!, body: `${who} a décliné ton invitation à ${t}.` });
      }
    }
    if (status === "CANCELLED" && cancelledAt && recent) {
      for (const [user, st] of s.members ?? []) {
        if (st === "ACCEPTED" || st === "PENDING") notify({ user, type: "MOMENT_CANCELLED", momentId: id, actor: s.host, createdAt: cancelledAt, body: `${`« ${s.title} »`} a été annulé par l'hôte.${s.cancelReason ? ` Motif : ${s.cancelReason}` : ""}` });
      }
    }
  }

  // Quelques signalements ouverts, pour tester l'espace de modération.
  const crowdSlugs = people.filter((p) => !p.admin && !p.guestOnly).map((p) => p.slug);
  const pickSlug = (i: number) => crowdSlugs[(i * 37) % crowdSlugs.length];
  const someMoment = momentRows.find((m) => m.status === "PUBLISHED" && m.startsAt > now && m.host !== "lea");
  const reports: DemoReportRow[] = [
    { reporter: pickSlug(3), targetUser: pickSlug(11), momentId: null, reason: "harassment", details: "Messages insistants après un Moment, alors que j'avais dit non.", createdAt: new Date(now.getTime() - 5 * H) },
    { reporter: pickSlug(7), targetUser: null, momentId: someMoment?.id ?? null, reason: "spam", details: "Le Moment renvoie vers une soirée payante, ce n'est pas indiqué.", createdAt: new Date(now.getTime() - 20 * H) },
    { reporter: pickSlug(19), targetUser: pickSlug(23), momentId: null, reason: "fake", details: "Les photos du profil ne semblent pas être les siennes.", createdAt: new Date(now.getTime() - 30 * H) },
  ].filter((x) => x.targetUser || x.momentId);

  return { users, moments: momentRows, memberships, notifications, reports };
}

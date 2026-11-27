/**
 * Repli de démonstration en LECTURE SEULE, utilisé uniquement si :
 *   - DEMO_MODE=true (jamais en production, voir lib/env.ts), ET
 *   - la base de données est injoignable.
 * L'interface affiche alors un bandeau « Mode démo hors ligne » : rien n'est caché.
 */
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { momentPhase } from "./mappers";
import { DEMO_TZ, demoCover, demoPhoto, moments, people } from "./demo-data";
import type { FeedQuery } from "@/lib/validation";
import type { FeedPage, MomentCardDTO, MomentDetailDTO, PersonSummary } from "./types";

function at(dayOffset: number, hhmm: string): Date {
  const d = new Date(Date.now() + dayOffset * 86400_000);
  const ymd = utcToZonedLocal(d, DEMO_TZ).slice(0, 10);
  return zonedLocalToUtc(`${ymd}T${hhmm}`, DEMO_TZ);
}

function person(slug: string): PersonSummary {
  const p = people.find((x) => x.slug === slug)!;
  return { id: `demo-${slug}`, name: p.name, username: slug, photoUrl: demoPhoto(p), isDemo: true };
}

function build(): MomentDetailDTO[] {
  return moments.map((s, i) => {
    const startsAt = at(s.day, s.start);
    let endsAt = s.end ? at(s.day, s.end) : null;
    if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400_000);
    const status = s.status ?? "PUBLISHED";
    const accepted = (s.members ?? []).filter((m) => m[1] === "ACCEPTED").map((m) => person(m[0]));
    const card: MomentCardDTO = {
      id: `demo-${i}`,
      title: s.title,
      description: s.description,
      category: s.category,
      vibeTags: s.tags,
      mediaType: s.media,
      mediaUrl: demoCover(s),
      posterUrl: s.posterUrl ?? null,
      textTheme: s.textTheme ?? null,
      city: s.city,
      area: s.area,
      placeName: s.placeName,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt?.toISOString() ?? null,
      timezone: DEMO_TZ,
      capacity: s.capacity,
      acceptedCount: accepted.length,
      spotsLeft: Math.max(0, s.capacity - accepted.length),
      status,
      visibility: s.visibility ?? "REQUEST",
      phase: momentPhase({ status, startsAt, endsAt }),
      isDemo: true,
      host: person(s.host),
      attendeesPreview: accepted.slice(0, 5),
      viewerMembership: null,
      isHost: false,
    };
    return {
      ...card,
      address: null,
      addressHidden: !!s.address,
      addressMembersOnly: true,
      showAttendees: true,
      cancelReason: s.cancelReason ?? null,
      attendees: accepted,
      members: null,
      pendingCount: 0,
    };
  });
}

export function demoFeed(q: FeedQuery): FeedPage {
  const items = build()
    .filter((m) => m.status === "PUBLISHED" && (m.visibility === "PUBLIC" || m.visibility === "REQUEST"))
    .filter((m) => m.phase === "upcoming" || m.phase === "ongoing")
    .filter((m) => !q.city || m.city.toLowerCase() === q.city.toLowerCase())
    .filter((m) => !q.category || m.category === q.category)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return { items, nextCursor: null, source: "demo-fallback" };
}

export function demoDetail(id: string): MomentDetailDTO | null {
  return build().find((m) => m.id === id) ?? null;
}

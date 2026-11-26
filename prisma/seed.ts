/**
 * Seed de démonstration Momento.
 *
 *   npm run db:seed
 *
 * - Ne touche QUE les données marquées isDemo (comptes @demo.momento.app et leurs Moments).
 *   Les vrais comptes et leurs Moments ne sont jamais modifiés ni supprimés.
 * - Les dates sont relatives au jour du seed : le feed a toujours des Moments à venir.
 * - Refuse de tourner en production sauf SEED_ALLOW_PRODUCTION=true.
 */
import { PrismaClient } from "@prisma/client";
import { DEMO_TZ as TZ, moments, people } from "../src/server/demo-data";
import { hashPassword } from "../src/lib/password";
import { utcToZonedLocal, zonedLocalToUtc } from "../src/lib/time";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "momento-demo";

function at(dayOffset: number, hhmm: string): Date {
  const d = new Date(Date.now() + dayOffset * 86400_000);
  const ymd = utcToZonedLocal(d, TZ).slice(0, 10);
  return zonedLocalToUtc(`${ymd}T${hhmm}`, TZ);
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Seed de démo refusé en production (SEED_ALLOW_PRODUCTION=true pour forcer).");
  }
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const ids = new Map<string, string>();

  for (const p of people) {
    const email = `${p.slug}@demo.momento.app`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && !existing.isDemo) throw new Error(`${email} existe et n'est pas un compte démo : arrêt.`);
    const data = {
      name: p.name,
      username: p.slug,
      city: p.city,
      bio: p.bio,
      interests: p.interests,
      photoUrl: p.admin ? null : `/demo/people/${p.slug}.webp`,
      isDemo: true,
      role: p.admin ? ("ADMIN" as const) : ("USER" as const),
      status: "ACTIVE" as const,
      passwordHash,
    };
    const u = await prisma.user.upsert({ where: { email }, create: { email, ...data }, update: data });
    ids.set(p.slug, u.id);
  }

  // On repart de zéro pour les seuls Moments de démo (et leurs participations, en cascade).
  const demoUserIds = [...ids.values()];
  await prisma.moment.deleteMany({ where: { isDemo: true, hostId: { in: demoUserIds } } });
  await prisma.notification.deleteMany({ where: { userId: { in: demoUserIds } } });
  await prisma.report.deleteMany({ where: { reporterId: { in: demoUserIds } } });
  await prisma.block.deleteMany({ where: { blockerId: { in: demoUserIds }, blockedId: { in: demoUserIds } } });

  let count = 0;
  for (const s of moments) {
    const hostId = ids.get(s.host)!;
    const startsAt = at(s.day, s.start);
    let endsAt = s.end ? at(s.day, s.end) : null;
    if (endsAt && endsAt <= startsAt) endsAt = new Date(endsAt.getTime() + 86400_000);
    const status = s.status ?? "PUBLISHED";
    const m = await prisma.moment.create({
      data: {
        hostId,
        title: s.title,
        description: s.description,
        category: s.category,
        vibeTags: s.tags,
        mediaType: s.media,
        mediaUrl: s.mediaUrl ?? null,
        posterUrl: s.posterUrl ?? null,
        textTheme: s.textTheme ?? null,
        city: s.city,
        area: s.area,
        placeName: s.placeName,
        address: s.address ?? null,
        addressMembersOnly: true,
        startsAt,
        endsAt,
        timezone: TZ,
        capacity: s.capacity,
        status,
        visibility: s.visibility ?? "REQUEST",
        isDemo: true,
        publishedAt: status === "DRAFT" ? null : new Date(Date.now() - (30 - count) * 3600_000),
        cancelledAt: status === "CANCELLED" ? new Date() : null,
        cancelReason: s.cancelReason ?? null,
      },
    });
    for (const [slug, mstatus, kind = "REQUEST", message] of s.members ?? []) {
      const userId = ids.get(slug)!;
      await prisma.momentMembership.create({
        data: {
          momentId: m.id,
          userId,
          initiatorId: kind === "INVITE" ? hostId : userId,
          kind,
          status: mstatus,
          message: message ?? null,
          respondedAt: mstatus === "PENDING" ? null : new Date(),
        },
      });
    }
    count++;
  }

  // Quelques notifications pour que l'écran ne soit pas vide.
  const lea = ids.get("lea")!;
  await prisma.notification.createMany({
    data: [
      { userId: lea, type: "JOIN_REQUEST", body: "Yaël S. demande à rejoindre « Sunset + verre sur la plage »." },
      { userId: lea, type: "INVITATION", body: "Karim B. t'invite à « Dîner sur invitation : anniversaire »." },
    ],
  });

  console.log(`Seed démo : ${people.length} profils fictifs, ${count} Moments. Mot de passe démo : ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

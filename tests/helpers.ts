import { prisma } from "@/lib/db";
import type { Viewer } from "@/lib/auth";
import { createMoment } from "@/server/moments";
import { utcToZonedLocal } from "@/lib/time";

let n = 0;

export async function resetDb() {
  if (!/test/i.test(process.env.DATABASE_URL ?? "")) throw new Error("resetDb refusé : ce n'est pas une base de test.");
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Upload","AuthToken","AuditEvent","Block","Report","Notification","MomentMembership","Moment","Session","User" CASCADE`,
  );
}

export async function makeUser(name = "User", extra: Partial<{ role: "USER" | "ADMIN"; status: "ACTIVE" | "SUSPENDED"; verified: boolean; adult: boolean }> = {}): Promise<Viewer> {
  n++;
  const u = await prisma.user.create({
    data: {
      email: `u${n}-${Date.now()}@test.local`,
      username: `user${n}_${Math.floor(Math.random() * 1e6)}`,
      name: `${name} ${n}`,
      role: extra.role ?? "USER",
      status: extra.status ?? "ACTIVE",
      emailVerifiedAt: extra.verified === false ? null : new Date(),
      ...(extra.adult ? { showAdult: true, adultConfirmedAt: new Date() } : {}),
    },
  });
  return { id: u.id, role: u.role, status: u.status, name: u.name, username: u.username, photoUrl: null, isDemo: false, city: "", emailVerifiedAt: u.emailVerifiedAt, phoneVerifiedAt: null, showAdult: u.showAdult, adultConfirmedAt: u.adultConfirmedAt };
}

export function localIn(days: number, tz = "Europe/Madrid") {
  return utcToZonedLocal(new Date(Date.now() + days * 86400_000), tz);
}

export async function makeMoment(host: Viewer, over: Record<string, unknown> = {}) {
  const res = await createMoment(host, {
    title: "Sunset test",
    description: "Un moment de test pour les vérifications.",
    category: "sunset",
    vibeTags: ["chill"],
    mediaType: "TEXT",
    city: "Marbella",
    area: "Plage",
    placeName: "Plage test",
    address: "Calle Secreta 1",
    startsAtLocal: localIn(2),
    timezone: "Europe/Madrid",
    capacity: 2,
    visibility: "REQUEST",
    publish: true,
    ...over,
  });
  return res.id;
}

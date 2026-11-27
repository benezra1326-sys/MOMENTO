/**
 * Seed de démonstration Momento.
 *
 *   npm run db:seed
 *
 * - Ne touche QUE les données marquées isDemo (comptes @demo.momento.app et leurs Moments).
 *   Les vrais comptes et leurs Moments ne sont jamais modifiés ni supprimés.
 * - Les dates sont relatives au jour du seed : le feed a toujours des Moments à venir.
 * - Refuse de tourner en production sauf SEED_ALLOW_PRODUCTION=true.
 *   En production, utiliser /api/admin/demo-seed (voir src/server/demo-seed.ts).
 */
import { PrismaClient } from "@prisma/client";
import { seedDemo } from "../src/server/demo-seed";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();
export const DEMO_PASSWORD = "momento-demo";

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Seed de démo refusé en production (SEED_ALLOW_PRODUCTION=true pour forcer).");
  }
  const n = await seedDemo(prisma, await hashPassword(DEMO_PASSWORD));
  console.log(
    `Seed démo : ${n.users} profils fictifs, ${n.moments} Moments, ${n.memberships} participations, ` +
      `${n.notifications} notifications, ${n.reports} signalements. Mot de passe démo : ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

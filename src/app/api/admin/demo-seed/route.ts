import { timingSafeEqual } from "node:crypto";
import { writeRoute } from "@/lib/route";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { isDemoMode } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { seedDemo } from "@/server/demo-seed";

export const maxDuration = 60;

const DEMO_PASSWORD = "momento-demo";

function tokenOk(given: string | null) {
  const expected = process.env.DEMO_SEED_TOKEN ?? "";
  if (expected.length < 24 || !given) return false;
  const a = Buffer.from(given), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recharge le jeu de démonstration (comptes isDemo uniquement). Triple verrou : mode démo actif,
 * session administrateur, et jeton DEMO_SEED_TOKEN (variable d'environnement) dans l'en-tête x-demo-seed-token.
 */
export const POST = writeRoute(async ({ req, viewer }) => {
  if (!isDemoMode()) throw new AppError("FORBIDDEN", "Le mode démo est désactivé.");
  if (!viewer || viewer.role !== "ADMIN") throw new AppError("FORBIDDEN", "Accès réservé à la modération.");
  if (!tokenOk(req.headers.get("x-demo-seed-token"))) throw new AppError("FORBIDDEN", "Jeton invalide.");
  return seedDemo(prisma, await hashPassword(DEMO_PASSWORD));
}, { json: false });

import { z } from "zod";
import { writeRoute } from "@/lib/route";
import { demoLogin } from "@/server/accounts";

/** Connexion à un profil fictif — DEMO_MODE uniquement. */
export const POST = writeRoute(async ({ body }) => demoLogin(z.object({ username: z.string() }).parse(body).username));

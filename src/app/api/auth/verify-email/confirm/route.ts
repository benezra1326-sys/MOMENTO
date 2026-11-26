import { writeRoute } from "@/lib/route";
import { confirmEmail } from "@/server/auth-tokens";

/** POST /api/auth/verify-email/confirm { token } — confirme l'adresse (jeton à usage unique). */
export const POST = writeRoute(async ({ body }) => confirmEmail(body));

import { writeRoute } from "@/lib/route";
import { requestPasswordReset } from "@/server/auth-tokens";

/** POST /api/auth/password/forgot { email } — réponse identique que le compte existe ou non. */
export const POST = writeRoute(async ({ body }) => requestPasswordReset(body));

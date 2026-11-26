import { writeRoute } from "@/lib/route";
import { resetPassword } from "@/server/auth-tokens";

/** POST /api/auth/password/reset { token, password } — nouveau mot de passe, autres sessions fermées. */
export const POST = writeRoute(async ({ body }) => resetPassword(body));

import { writeRoute } from "@/lib/route";
import { resendVerification } from "@/server/auth-tokens";

/** POST /api/auth/verify-email — renvoie le lien de confirmation à l'utilisateur connecté. */
export const POST = writeRoute(async ({ viewer }) => resendVerification(viewer));

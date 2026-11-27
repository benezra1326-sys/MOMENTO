import { writeRoute } from "@/lib/route";
import { startPhoneLogin } from "@/server/phone";

/** POST /api/auth/phone/start { phone } — envoie un code par SMS. */
export const POST = writeRoute(async ({ body }) => startPhoneLogin(body));

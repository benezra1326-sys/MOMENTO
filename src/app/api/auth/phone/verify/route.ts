import { createSession } from "@/lib/auth";
import { writeRoute } from "@/lib/route";
import { verifyPhoneLogin } from "@/server/phone";

/** POST /api/auth/phone/verify { phone, code } — vérifie le code et ouvre la session. */
export const POST = writeRoute(async ({ body }) => {
  const user = await verifyPhoneLogin(body);
  await createSession(user.id);
  return user;
});

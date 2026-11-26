import { writeRoute } from "@/lib/route";
import { logout } from "@/server/accounts";

export const POST = writeRoute(async () => {
  await logout();
  return { ok: true };
});

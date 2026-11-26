import { z } from "zod";
import { writeRoute } from "@/lib/route";
import { deleteMyAccount } from "@/server/accounts";

/** DELETE /api/me — suppression du compte (confirmation par le pseudo). */
export const DELETE = writeRoute(async ({ viewer, body }) => {
  const { confirmUsername } = z.object({ confirmUsername: z.string() }).parse(body);
  return deleteMyAccount(viewer, confirmUsername);
});

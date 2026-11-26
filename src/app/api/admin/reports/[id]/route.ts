import { z } from "zod";
import { writeRoute } from "@/lib/route";
import { resolveReport } from "@/server/safety";

const schema = z.object({
  action: z.enum(["dismiss", "suspend_user", "cancel_moment", "resolve"]),
  note: z.string().max(500).default(""),
});

export const POST = writeRoute<{ id: string }>(async ({ viewer, params, body }) => {
  const { action, note } = schema.parse(body);
  return resolveReport(viewer, params.id, action, note);
});

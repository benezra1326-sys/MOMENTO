import { z } from "zod";
import { writeRoute } from "@/lib/route";
import { blockUser, unblockUser } from "@/server/safety";

const schema = z.object({ username: z.string().min(1) });

export const POST = writeRoute(async ({ viewer, body }) => blockUser(viewer, schema.parse(body).username));
export const DELETE = writeRoute(async ({ viewer, body }) => unblockUser(viewer, schema.parse(body).username));

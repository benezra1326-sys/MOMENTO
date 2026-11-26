import { writeRoute } from "@/lib/route";
import { markAllRead } from "@/server/notifications";

export const POST = writeRoute(async ({ viewer }) => markAllRead(viewer));

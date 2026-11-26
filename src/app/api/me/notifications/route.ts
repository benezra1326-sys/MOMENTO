import { readRoute } from "@/lib/route";
import { listNotifications } from "@/server/notifications";

export const GET = readRoute(async ({ viewer }) => listNotifications(viewer));

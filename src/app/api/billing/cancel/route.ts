import { writeRoute } from "@/lib/route";
import { cancelPremium } from "@/server/billing";

/** POST /api/billing/cancel — résilie Upclose+. */
export const POST = writeRoute(async ({ viewer }) => cancelPremium(viewer));

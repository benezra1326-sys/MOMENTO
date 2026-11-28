import { writeRoute } from "@/lib/route";
import { boostMoment } from "@/server/billing";

/** POST /api/moments/:id/boost — Upclose+ : met le Moment en tête du feed pendant 24 h. */
export const POST = writeRoute<{ id: string }>(async ({ viewer, params }) => boostMoment(viewer, params.id));

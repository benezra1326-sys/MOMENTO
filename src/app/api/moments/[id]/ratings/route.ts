import { readRoute, writeRoute } from "@/lib/route";
import { rateTargets, submitRatings } from "@/server/ratings";

export const dynamic = "force-dynamic";

/** GET : personnes à noter pour ce Moment. POST { ratings: [...] } : notes privées et définitives. */
export const GET = readRoute<{ id: string }>(async ({ viewer, params }) => rateTargets(viewer, params.id));
export const POST = writeRoute<{ id: string }>(async ({ viewer, params, body }) => submitRatings(viewer, params.id, body));

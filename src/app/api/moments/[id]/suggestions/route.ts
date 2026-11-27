import { readRoute } from "@/lib/route";
import { suggestInvitees } from "@/server/matching";

export const dynamic = "force-dynamic";

/** GET /api/moments/:id/suggestions — personnes dispo à inviter (hôte uniquement). */
export const GET = readRoute<{ id: string }>(async ({ viewer, params }) => suggestInvitees(viewer, params.id));

import { writeRoute } from "@/lib/route";
import { reviewVerification } from "@/server/verification";

/** POST /api/admin/verifications/:id { approve: boolean, reason? } */
export const POST = writeRoute<{ id: string }>(async ({ viewer, params, body }) => reviewVerification(viewer, params.id, body));

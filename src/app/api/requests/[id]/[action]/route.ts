import { AppError } from "@/lib/errors";
import { writeRoute } from "@/lib/route";
import { cancelMembership, respondToMembership } from "@/server/memberships";

/** POST /api/requests/:id/accept | decline | cancel */
export const POST = writeRoute<{ id: string; action: string }>(async ({ viewer, params }) => {
  if (params.action === "accept" || params.action === "decline") {
    return respondToMembership(viewer, params.id, params.action);
  }
  if (params.action === "cancel") return cancelMembership(viewer, params.id);
  throw new AppError("NOT_FOUND", "Action inconnue.");
});

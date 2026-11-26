import { writeRoute } from "@/lib/route";
import { requestToJoin } from "@/server/memberships";

export const POST = writeRoute<{ id: string }>(
  async ({ viewer, params, body }) => requestToJoin(viewer, params.id, body),
  { status: 201 },
);

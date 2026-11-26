import { writeRoute } from "@/lib/route";
import { inviteUser } from "@/server/memberships";

export const POST = writeRoute<{ id: string }>(
  async ({ viewer, params, body }) => inviteUser(viewer, params.id, body),
  { status: 201 },
);

import { readRoute } from "@/lib/route";
import { myInvitations } from "@/server/memberships";

export const GET = readRoute(async ({ viewer }) => myInvitations(viewer));

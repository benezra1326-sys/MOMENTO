import { readRoute, writeRoute } from "@/lib/route";
import { getMyProfile, updateMyProfile } from "@/server/accounts";

export const GET = readRoute(async ({ viewer }) => getMyProfile(viewer));
export const PATCH = writeRoute(async ({ viewer, body }) => updateMyProfile(viewer, body));

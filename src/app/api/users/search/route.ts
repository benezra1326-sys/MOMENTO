import { readRoute } from "@/lib/route";
import { searchPeople } from "@/server/people";

/** GET /api/users/search?q=… : 6 membres au plus, pour l'invitation par pseudo. */
export const GET = readRoute(async ({ req, viewer }) => searchPeople(viewer, new URL(req.url).searchParams.get("q")));

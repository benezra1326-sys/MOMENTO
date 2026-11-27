import { writeRoute } from "@/lib/route";
import { setAdultSpace } from "@/server/accounts";

/** PATCH /api/me/adult — active ou désactive l'espace adulte (18+). */
export const PATCH = writeRoute(async ({ viewer, body }) => setAdultSpace(viewer, body));

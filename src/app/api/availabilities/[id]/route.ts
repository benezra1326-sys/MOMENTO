import { readRoute, writeRoute } from "@/lib/route";
import { deleteAvailability, getAvailability, updateAvailability } from "@/server/availability";

type P = { id: string };

export const GET = readRoute<P>(async ({ viewer, params }) => getAvailability(viewer, params.id));
/** PATCH — modifier, masquer (hidden: true) ou réafficher. Auteur uniquement. */
export const PATCH = writeRoute<P>(async ({ viewer, params, body }) => updateAvailability(viewer, params.id, body));
export const DELETE = writeRoute<P>(async ({ viewer, params }) => deleteAvailability(viewer, params.id), { json: false });

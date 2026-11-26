import { readRoute, writeRoute } from "@/lib/route";
import { updateMoment } from "@/server/moments";
import { loadMomentDetail } from "@/server/loaders";

type P = { id: string };

export const GET = readRoute<P>(async ({ viewer, params }) => loadMomentDetail(viewer, params.id));
export const PATCH = writeRoute<P>(async ({ viewer, params, body }) => updateMoment(viewer, params.id, body));

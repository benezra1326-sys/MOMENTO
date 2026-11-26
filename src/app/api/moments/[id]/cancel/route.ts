import { writeRoute } from "@/lib/route";
import { cancelMoment } from "@/server/moments";

export const POST = writeRoute<{ id: string }>(async ({ viewer, params, body }) => cancelMoment(viewer, params.id, body));

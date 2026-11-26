import { writeRoute } from "@/lib/route";
import { publishMoment } from "@/server/moments";

export const POST = writeRoute<{ id: string }>(async ({ viewer, params }) => publishMoment(viewer, params.id));

import { writeRoute } from "@/lib/route";
import { createReport } from "@/server/safety";

export const POST = writeRoute(async ({ viewer, body }) => createReport(viewer, body), { status: 201 });

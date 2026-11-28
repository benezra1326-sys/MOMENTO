import { readRoute, writeRoute } from "@/lib/route";
import { myVerification, startVerification } from "@/server/verification";

/** GET : état de la certification. POST : ouvre une demande et tire le geste à faire. */
export const GET = readRoute(async ({ viewer }) => myVerification(viewer));
export const POST = writeRoute(async ({ viewer, body }) => startVerification(viewer, body));

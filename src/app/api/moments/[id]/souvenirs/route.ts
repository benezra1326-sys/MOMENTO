import { readRoute, writeRoute } from "@/lib/route";
import { addSouvenir, listSouvenirs } from "@/server/souvenirs";

export const dynamic = "force-dynamic";

export const GET = readRoute<{ id: string }>(async ({ viewer, params }) => listSouvenirs(viewer, params.id));
export const POST = writeRoute<{ id: string }>(async ({ viewer, params, body }) => addSouvenir(viewer, params.id, body), { status: 201 });

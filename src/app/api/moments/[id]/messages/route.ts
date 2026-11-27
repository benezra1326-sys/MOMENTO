import { readRoute, writeRoute } from "@/lib/route";
import { listMessages, postMessage } from "@/server/messages";

export const dynamic = "force-dynamic";

/** GET /api/moments/:id/messages?after=ISO — discussion du Moment (hôte et participants confirmés). */
export const GET = readRoute<{ id: string }>(async ({ req, viewer, params }) =>
  listMessages(viewer, params.id, new URL(req.url).searchParams.get("after")),
);
export const POST = writeRoute<{ id: string }>(async ({ viewer, params, body }) => postMessage(viewer, params.id, body), { status: 201 });

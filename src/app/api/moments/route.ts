import { readRoute, writeRoute } from "@/lib/route";
import { createMoment } from "@/server/moments";
import { loadFeed } from "@/server/loaders";

export const dynamic = "force-dynamic";

/** GET /api/moments?city=&category=&when=&from=&sort=&cursor= — feed filtré et paginé. */
export const GET = readRoute(async ({ req, viewer }) => {
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  return loadFeed(viewer, sp);
});

/** POST /api/moments — crée un brouillon ou publie (publish: true). */
export const POST = writeRoute(async ({ viewer, body }) => createMoment(viewer, body), { status: 201 });

import { readRoute, writeRoute } from "@/lib/route";
import { AppError } from "@/lib/errors";
import { productConfig } from "@/config/product";
import { createAvailability, listAvailabilities, myAvailabilities } from "@/server/availability";

export const dynamic = "force-dynamic";

function assertEnabled() {
  if (!productConfig.features.availability) throw new AppError("NOT_FOUND", "Les disponibilités ne sont pas ouvertes.");
}

/** GET /api/availabilities?city=&when=  (ou ?mine=1 pour mes disponibilités) */
export const GET = readRoute(async ({ req, viewer }) => {
  assertEnabled();
  const sp = Object.fromEntries(new URL(req.url).searchParams);
  if (sp.mine) return myAvailabilities(viewer);
  return listAvailabilities(viewer, sp);
});

/** POST /api/availabilities — publie « je suis dispo ». */
export const POST = writeRoute(async ({ viewer, body }) => {
  assertEnabled();
  return createAvailability(viewer, body);
}, { status: 201 });

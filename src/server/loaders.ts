import { isDemoMode } from "@/lib/env";
import { isDatabaseUnavailable } from "@/lib/errors";
import type { Viewer } from "@/lib/auth";
import { feedQuerySchema } from "@/lib/validation";
import { getFeed, getMomentDetail } from "./moments";
import { demoDetail, demoFeed } from "./demo-fallback";
import type { FeedPage, MomentDetailDTO } from "./types";

/**
 * Feed avec repli démo explicite. Hors DEMO_MODE, une panne de base remonte
 * comme une erreur (écran d'erreur), elle n'est jamais masquée.
 */
export async function loadFeed(viewer: Viewer | null, query: unknown): Promise<FeedPage> {
  try {
    return await getFeed(viewer, query);
  } catch (err) {
    if (isDatabaseUnavailable(err) && isDemoMode()) {
      console.warn("[demo] base injoignable : repli sur les données de démo en lecture seule");
      return demoFeed(feedQuerySchema.parse(query ?? {}));
    }
    throw err;
  }
}

export async function loadMomentDetail(
  viewer: Viewer | null,
  id: string,
): Promise<{ moment: MomentDetailDTO; source: "database" | "demo-fallback" }> {
  if (id.startsWith("demo-") && isDemoMode()) {
    const m = demoDetail(id);
    if (m) return { moment: m, source: "demo-fallback" };
  }
  try {
    return { moment: await getMomentDetail(viewer, id), source: "database" };
  } catch (err) {
    if (isDatabaseUnavailable(err) && isDemoMode()) {
      const m = demoDetail(id);
      if (m) return { moment: m, source: "demo-fallback" };
    }
    throw err;
  }
}

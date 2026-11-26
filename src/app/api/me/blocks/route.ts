import { readRoute } from "@/lib/route";
import { listMyBlocks } from "@/server/safety";

export const GET = readRoute(async ({ viewer }) => listMyBlocks(viewer));

import { readRoute } from "@/lib/route";
import { listReports } from "@/server/safety";

export const GET = readRoute(async ({ req, viewer }) => {
  const status = new URL(req.url).searchParams.get("status");
  return listReports(viewer, status === "RESOLVED" || status === "DISMISSED" ? status : "OPEN");
});

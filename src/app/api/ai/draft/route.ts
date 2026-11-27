import { writeRoute } from "@/lib/route";
import { draftFromSentence } from "@/server/ai";

/** POST /api/ai/draft { text, kind? } — une phrase devient un brouillon de Moment ou de dispo, à relire. */
export const POST = writeRoute(async ({ viewer, body }) => draftFromSentence(viewer, body));

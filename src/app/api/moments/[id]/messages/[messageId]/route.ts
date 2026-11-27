import { writeRoute } from "@/lib/route";
import { deleteMessage } from "@/server/messages";

export const DELETE = writeRoute<{ id: string; messageId: string }>(
  async ({ viewer, params }) => deleteMessage(viewer, params.id, params.messageId),
  { json: false },
);

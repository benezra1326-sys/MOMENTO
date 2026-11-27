import { writeRoute } from "@/lib/route";
import { deleteSouvenir } from "@/server/souvenirs";

export const DELETE = writeRoute<{ id: string; souvenirId: string }>(
  async ({ viewer, params }) => deleteSouvenir(viewer, params.id, params.souvenirId),
  { json: false },
);

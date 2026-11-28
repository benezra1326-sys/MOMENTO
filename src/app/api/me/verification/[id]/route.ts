import { assertSameOrigin, fail, ok } from "@/lib/api";
import { getViewer } from "@/lib/auth";
import { submitSelfie } from "@/server/verification";

/** POST /api/me/verification/:id (multipart: file) — le selfie pris à la caméra. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    const { id } = await ctx.params;
    const form = await req.formData();
    const file = form.get("file");
    return ok(await submitSelfie(viewer, id, file instanceof File ? file : null), 201);
  } catch (e) {
    return fail(e);
  }
}

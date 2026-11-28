import { assertSameOrigin, fail, ok } from "@/lib/api";
import { getViewer } from "@/lib/auth";
import { submitVideoCheck } from "@/server/verification";

/** POST /api/me/verification/:id (multipart : frame0, frame1…) — une image par mouvement, prise à la caméra. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    const { id } = await ctx.params;
    const form = await req.formData();
    const files = [...form.entries()]
      .filter(([k, v]) => /^frame\d+$/.test(k) && v instanceof File)
      .sort(([a], [b]) => Number(a.slice(5)) - Number(b.slice(5)))
      .map(([, v]) => v as File);
    return ok(await submitVideoCheck(viewer, id, files), 201);
  } catch (e) {
    return fail(e);
  }
}

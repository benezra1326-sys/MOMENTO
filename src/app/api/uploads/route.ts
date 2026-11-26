import { assertSameOrigin, fail, ok } from "@/lib/api";
import { getViewer } from "@/lib/auth";
import { uploadImage } from "@/server/uploads";

/** POST /api/uploads (multipart: file, purpose=cover|avatar) */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    const form = await req.formData();
    const file = form.get("file");
    const purpose = form.get("purpose") === "avatar" ? "avatar" : "cover";
    return ok(await uploadImage(viewer, file instanceof File ? file : null, purpose), 201);
  } catch (e) {
    return fail(e);
  }
}

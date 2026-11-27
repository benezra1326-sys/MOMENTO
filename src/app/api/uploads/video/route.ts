import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { assertSameOrigin, fail, ok } from "@/lib/api";
import { getViewer } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { storageDriver } from "@/server/storage";
import { authorizeVideoUpload, newVideoPath, uploadVideoLocally, videoUploadInfo } from "@/server/video-uploads";

export const dynamic = "force-dynamic";

/** GET /api/uploads/video?type=video/mp4 — réglages d'envoi et chemin proposé. */
export async function GET(req: Request) {
  try {
    const viewer = await getViewer();
    if (!viewer) throw new AppError("UNAUTHENTICATED", "Connecte-toi pour continuer.");
    const type = new URL(req.url).searchParams.get("type");
    return ok({ ...videoUploadInfo(), pathname: type ? newVideoPath(type) : null });
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST /api/uploads/video
 * - stockage Blob : protocole d'envoi direct de @vercel/blob (JSON), le serveur ne délivre qu'un jeton ;
 * - stockage local (dev) : multipart « file ».
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const viewer = await getViewer();
    if (storageDriver() !== "blob") {
      const form = await req.formData();
      const file = form.get("file");
      return ok(await uploadVideoLocally(viewer, file instanceof File ? file : null), 201);
    }
    const body = (await req.json()) as HandleUploadBody;
    if (body.type !== "blob.generate-client-token") throw new AppError("FORBIDDEN", "Requête refusée.");
    const res = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname) => authorizeVideoUpload(viewer, pathname),
    });
    return Response.json(res);
  } catch (e) {
    return fail(e);
  }
}

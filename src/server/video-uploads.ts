import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors";
import { requireVerified, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { prisma } from "@/lib/db";
import { VIDEO_TYPES } from "@/lib/media";
import { storageDriver, storeFile } from "./storage";

/**
 * Vidéos des membres (docs/MEDIA.md).
 * En production le navigateur envoie le fichier directement à Vercel Blob (les fonctions Vercel
 * refusent les corps de plus de 4,5 Mo) : le serveur vérifie le compte, le quota, le type et la
 * taille, puis délivre un jeton valable pour un seul chemin media/video/<uuid>.<ext>.
 * Pas de transcodage : MP4 (H.264) est le format le plus sûr pour tous les navigateurs.
 */

const PATH_RE = /^media\/video\/[0-9a-f-]{36}\.(mp4|webm|mov)$/;

export function videoUploadInfo() {
  return {
    enabled: productConfig.features.memberVideos && storageDriver() !== "none",
    driver: storageDriver(),
    maxBytes: productConfig.limits.videoMaxBytes,
    maxSeconds: productConfig.limits.videoMaxSeconds,
    types: Object.keys(VIDEO_TYPES),
  };
}

async function assertCanUpload(viewerIn: Viewer | null) {
  const viewer = requireVerified(viewerIn);
  if (!productConfig.features.memberVideos) throw new AppError("FORBIDDEN", "L'envoi de vidéos n'est pas ouvert.");
  if (storageDriver() === "none") throw new AppError("INTERNAL", "Le stockage des médias n'est pas configuré sur ce serveur.");
  const recent = await prisma.upload.count({
    where: { userId: viewer.id, purpose: "video", createdAt: { gt: new Date(Date.now() - 3600_000) } },
  });
  if (recent >= productConfig.limits.videoUploadsPerHour) {
    throw new AppError("RATE_LIMITED", "Trop de vidéos envoyées en une heure. Réessaie plus tard.");
  }
  return viewer;
}

/** Chemin de stockage proposé au navigateur pour un type donné. */
export function newVideoPath(contentType: string) {
  const ext = VIDEO_TYPES[contentType];
  if (!ext) throw new AppError("VALIDATION", "Formats acceptés : MP4, MOV ou WebM.");
  return `media/video/${randomUUID()}.${ext}`;
}

/** Jeton d'envoi direct (Vercel Blob) pour un chemin précis. */
export async function authorizeVideoUpload(viewerIn: Viewer | null, pathname: string) {
  const viewer = await assertCanUpload(viewerIn);
  if (!PATH_RE.test(pathname)) throw new AppError("VALIDATION", "Chemin de vidéo invalide.");
  await prisma.upload.create({
    data: { userId: viewer.id, url: pathname, purpose: "video", bytes: productConfig.limits.videoMaxBytes },
  });
  return {
    allowedContentTypes: Object.keys(VIDEO_TYPES),
    maximumSizeInBytes: productConfig.limits.videoMaxBytes,
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
    validUntil: Date.now() + 15 * 60_000,
  };
}

/** Envoi classique (développement, stockage local) : le fichier passe par le serveur. */
export async function uploadVideoLocally(viewerIn: Viewer | null, file: File | null) {
  const viewer = await assertCanUpload(viewerIn);
  if (!file) throw new AppError("VALIDATION", "Aucun fichier reçu.");
  if (file.size > productConfig.limits.videoMaxBytes) {
    throw new AppError("VALIDATION", `Vidéo trop lourde (${Math.round(productConfig.limits.videoMaxBytes / 1024 / 1024)} Mo maximum).`);
  }
  const key = newVideoPath(file.type).replace(/^media\//, "");
  const url = await storeFile(key, Buffer.from(await file.arrayBuffer()), file.type);
  await prisma.upload.create({ data: { userId: viewer.id, url, purpose: "video", bytes: file.size } });
  return { url };
}

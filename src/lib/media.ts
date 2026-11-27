/** Règles sur les URL de médias, partagées par la validation et le stockage (voir docs/MEDIA.md). */

/** Hôtes des médias acceptés dans mediaUrl / posterUrl / photoUrl. */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Vrai si l'URL désigne un média servi par nous : visuels démo, uploads locaux (dev),
 * ou fichier de notre stockage Vercel Blob. Toute autre URL externe est refusée.
 */
export function isAllowedMediaUrl(url: string): boolean {
  if (url.startsWith("/demo/")) return !url.includes("..");
  if (url.startsWith("/uploads/")) return !url.includes("..") && (/^\/uploads\/(cover|avatar)\/[\w-]+\.webp$/.test(url) || LOCAL_VIDEO.test(url));
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX) && u.pathname.startsWith("/media/");
  } catch {
    return false;
  }
}

/** Extensions et types acceptés pour les vidéos des membres (lues telles quelles, sans transcodage). */
export const VIDEO_TYPES: Record<string, string> = { "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" };
const LOCAL_VIDEO = /^\/uploads\/video\/[\w-]+\.(mp4|webm|mov)$/;
const BLOB_VIDEO = /^\/media\/video\/[\w-]+\.(mp4|webm|mov)$/;

/**
 * Vidéo d'un Moment : vidéos démo, et, si l'envoi par les membres est ouvert, fichiers
 * envoyés dans notre stockage sous media/video/ (ou /uploads/video/ en développement).
 */
export function isAllowedVideoUrl(url: string, memberVideos = true): boolean {
  if (url.startsWith("/demo/")) return !url.includes("..");
  if (!memberVideos) return false;
  if (url.startsWith("/uploads/")) return !url.includes("..") && LOCAL_VIDEO.test(url);
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX) && BLOB_VIDEO.test(u.pathname);
  } catch {
    return false;
  }
}

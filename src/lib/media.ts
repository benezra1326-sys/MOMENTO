/** Règles sur les URL de médias, partagées par la validation et le stockage (voir docs/MEDIA.md). */

/** Hôtes des médias acceptés dans mediaUrl / posterUrl / photoUrl. */
export const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

/**
 * Vrai si l'URL désigne un média servi par nous : visuels démo, uploads locaux (dev),
 * ou fichier de notre stockage Vercel Blob. Toute autre URL externe est refusée.
 */
export function isAllowedMediaUrl(url: string): boolean {
  if (url.startsWith("/demo/")) return !url.includes("..");
  if (url.startsWith("/uploads/")) return !url.includes("..") && /^\/uploads\/(cover|avatar)\/[\w-]+\.webp$/.test(url);
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname.endsWith(BLOB_HOST_SUFFIX) && u.pathname.startsWith("/media/");
  } catch {
    return false;
  }
}

/** La vidéo n'est pas encore publiable par les utilisateurs : seules les vidéos démo sont acceptées. */
export function isAllowedVideoUrl(url: string): boolean {
  return url.startsWith("/demo/") && !url.includes("..");
}

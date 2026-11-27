import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { del, put } from "@vercel/blob";
import { isAllowedMediaUrl } from "@/lib/media";
import { galleryUrls } from "@/lib/gallery";
import demoMedia from "./demo-media.json";

/** Photos du jeu de démonstration et de la galerie : partagées ou rechargées par le seed, jamais supprimées. */
const protectedMedia = new Set<string>([
  ...galleryUrls,
  ...Object.values((demoMedia as { avatars: Record<string, string> }).avatars),
  ...Object.values((demoMedia as { covers: Record<string, string> }).covers),
]);
function isProtectedDemoMedia(url: string) {
  return protectedMedia.has(url);
}

/**
 * Stockage des fichiers médias (voir docs/MEDIA.md).
 * - « blob »  : Vercel Blob, persistant, utilisé en production (BLOB_READ_WRITE_TOKEN).
 * - « local » : dossier public/uploads, pour le développement uniquement.
 * - « none »  : aucun stockage : l'envoi de fichiers est refusé proprement.
 */
export type StorageDriver = "blob" | "local" | "none";

export function storageDriver(): StorageDriver {
  const explicit = process.env.STORAGE_DRIVER;
  if (explicit === "blob" || explicit === "local" || explicit === "none") return explicit;
  if (process.env.BLOB_READ_WRITE_TOKEN) return "blob";
  return process.env.NODE_ENV === "production" ? "none" : "local";
}

/** Écrit un fichier et renvoie son URL publique stable. */
export async function storeFile(key: string, body: Buffer, contentType: string): Promise<string> {
  const driver = storageDriver();
  if (driver === "blob") {
    const res = await put(`media/${key}`, body, {
      access: "public",
      contentType,
      addRandomSuffix: false,
      cacheControlMaxAge: 60 * 60 * 24 * 365,
    });
    return res.url;
  }
  if (driver === "local") {
    const file = path.join(process.cwd(), "public", "uploads", key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return `/uploads/${key}`;
  }
  throw new Error("storage_not_configured");
}

/**
 * Supprime un fichier que nous avons stocké (remplacement de visuel, suppression de compte).
 * Ignore les visuels démo et toute URL qui n'est pas à nous. N'échoue jamais : un fichier
 * orphelin vaut mieux qu'une action utilisateur bloquée.
 */
export async function deleteStoredFile(url: string | null | undefined): Promise<void> {
  if (!url || url.startsWith("/demo/") || isProtectedDemoMedia(url)) return;
  try {
    if (url.startsWith("/uploads/") && isAllowedMediaUrl(url)) {
      await unlink(path.join(process.cwd(), "public", url));
      return;
    }
    if (isAllowedMediaUrl(url) && storageDriver() === "blob") await del(url);
  } catch (e) {
    console.warn("[storage] suppression impossible", (e as Error).message);
  }
}

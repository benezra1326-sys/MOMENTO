import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Stockage des médias. Les métadonnées vivent en base (mediaUrl), les fichiers ici.
 * - « local » : dossier public/uploads, pour le développement uniquement.
 * - En production, brancher un stockage objet (S3, R2, Supabase Storage…) : voir docs/MEDIA.md.
 */
function storageDriver(): "local" | "none" {
  const driver = process.env.STORAGE_DRIVER ?? (process.env.NODE_ENV === "production" ? "none" : "local");
  return driver === "local" ? "local" : "none";
}

/**
 * Téléverse une image : vérifie type, taille et dimensions, corrige l'orientation,
 * redimensionne et ré-encode en WebP. Le ré-encodage supprime toutes les métadonnées
 * (EXIF, dont la géolocalisation GPS).
 */
export async function uploadImage(viewerIn: Viewer | null, file: File | null, purpose: "cover" | "avatar") {
  requireActive(viewerIn);
  if (!file) throw new AppError("VALIDATION", "Aucun fichier reçu.");
  if (!ALLOWED.has(file.type)) throw new AppError("VALIDATION", "Formats acceptés : JPEG, PNG ou WebP.");
  if (file.size > productConfig.limits.uploadMaxBytes) {
    throw new AppError("VALIDATION", `Image trop lourde (${Math.round(productConfig.limits.uploadMaxBytes / 1024 / 1024)} Mo maximum).`);
  }
  if (storageDriver() === "none") {
    throw new AppError("INTERNAL", "Le stockage des médias n'est pas configuré sur ce serveur.");
  }

  const input = Buffer.from(await file.arrayBuffer());
  let meta: Metadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new AppError("VALIDATION", "Ce fichier n'est pas une image lisible.");
  }
  const max = productConfig.limits.uploadMaxDimension;
  if (!meta.width || !meta.height || meta.width > max || meta.height > max) {
    throw new AppError("VALIDATION", `Dimensions invalides (${max} px maximum par côté).`);
  }
  if (meta.width < 200 || meta.height < 200) throw new AppError("VALIDATION", "Image trop petite (200 px minimum).");

  const pipeline =
    purpose === "avatar"
      ? sharp(input).rotate().resize(512, 512, { fit: "cover", position: "attention" })
      : sharp(input).rotate().resize(1080, 1350, { fit: "cover", position: "attention", withoutEnlargement: false });
  // sharp n'écrit aucune métadonnée sauf appel explicite à withMetadata() : EXIF/GPS supprimés.
  const out = await pipeline.webp({ quality: 82 }).toBuffer();

  const name = `${randomUUID()}.webp`;
  const dir = path.join(process.cwd(), "public", "uploads", purpose);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), out);
  return { url: `/uploads/${purpose}/${name}`, width: purpose === "avatar" ? 512 : 1080, height: purpose === "avatar" ? 512 : 1350 };
}

"use client";

const MAX_BYTES = 3.5 * 1024 * 1024;
const MAX_SIDE = 2560;

/**
 * Réduit une photo trop lourde dans le navigateur avant l'envoi (les fonctions Vercel
 * refusent les requêtes de plus de 4,5 Mo). Le serveur ré-encode de toute façon en WebP.
 * En cas d'échec (format non lisible par le navigateur), le fichier d'origine est renvoyé.
 */
export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= MAX_BYTES || !file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

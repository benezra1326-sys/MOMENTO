"use client";

import { upload } from "@vercel/blob/client";

type Info = { enabled: boolean; driver: "blob" | "local" | "none"; maxBytes: number; maxSeconds: number; types: string[]; pathname: string | null };

export type VideoUploadResult = { ok: true; url: string; posterUrl: string | null } | { ok: false; message: string };

/** Lit la durée et capture une image vers 1 s pour servir d'affiche (fichier local : pas de souci CORS). */
async function probe(file: File): Promise<{ duration: number; poster: Blob | null }> {
  const src = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = src;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("unreadable"));
      setTimeout(() => reject(new Error("timeout")), 15000);
    });
    const duration = video.duration;
    let poster: Blob | null = null;
    try {
      video.currentTime = Math.min(1, (duration || 2) / 2);
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        setTimeout(() => reject(new Error("seek")), 8000);
      });
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      poster = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.86));
      if (poster && poster.size < 2000) poster = null;
    } catch {
      poster = null;
    }
    return { duration, poster };
  } finally {
    URL.revokeObjectURL(src);
  }
}

async function json<T>(res: Response): Promise<{ ok: true; data: T } | { ok: false; error: { message: string } }> {
  try {
    return await res.json();
  } catch {
    return { ok: false, error: { message: `Erreur ${res.status}.` } };
  }
}

/**
 * Envoie la vidéo d'un Moment : vérifie format, poids et durée, envoie le fichier (directement au
 * stockage en production), puis l'image d'affiche. `t` traduit les messages d'erreur.
 */
export async function uploadMomentVideo(
  file: File,
  t: (s: string, v?: Record<string, string | number>) => string,
  onProgress?: (pct: number) => void,
): Promise<VideoUploadResult> {
  const infoRes = await json<Info>(await fetch(`/api/uploads/video?type=${encodeURIComponent(file.type)}`));
  if (!infoRes.ok) return { ok: false, message: infoRes.error.message };
  const info = infoRes.data;
  if (!info.enabled) return { ok: false, message: t("L'envoi de vidéos n'est pas disponible pour le moment.") };
  if (!info.types.includes(file.type)) return { ok: false, message: t("Formats acceptés : MP4, MOV ou WebM.") };
  if (file.size > info.maxBytes) {
    return { ok: false, message: t("Vidéo trop lourde ({n} Mo maximum).", { n: Math.round(info.maxBytes / 1024 / 1024) }) };
  }
  let probed: { duration: number; poster: Blob | null };
  try {
    probed = await probe(file);
  } catch {
    return { ok: false, message: t("Ce navigateur ne sait pas lire cette vidéo. Essaie un fichier MP4.") };
  }
  if (probed.duration > info.maxSeconds + 0.5) {
    return { ok: false, message: t("Vidéo trop longue ({n} secondes maximum).", { n: info.maxSeconds }) };
  }

  let url: string;
  try {
    if (info.driver === "blob" && info.pathname) {
      const blob = await upload(info.pathname, file, {
        access: "public",
        handleUploadUrl: "/api/uploads/video",
        contentType: file.type,
        multipart: file.size > 8 * 1024 * 1024,
        onUploadProgress: (p) => onProgress?.(Math.round(p.percentage)),
      });
      url = blob.url;
    } else {
      const fd = new FormData();
      fd.set("file", file);
      const res = await json<{ url: string }>(await fetch("/api/uploads/video", { method: "POST", body: fd }));
      if (!res.ok) return { ok: false, message: res.error.message };
      url = res.data.url;
    }
  } catch (e) {
    const msg = (e as Error).message || "";
    return { ok: false, message: msg && !/fetch|network/i.test(msg) ? t(msg) : t("Envoi impossible. Vérifie ta connexion.") };
  }
  onProgress?.(100);

  let posterUrl: string | null = null;
  if (probed.poster) {
    const fd = new FormData();
    fd.set("file", new File([probed.poster], "poster.jpg", { type: "image/jpeg" }));
    fd.set("purpose", "cover");
    const res = await json<{ url: string }>(await fetch("/api/uploads", { method: "POST", body: fd }));
    if (res.ok) posterUrl = res.data.url;
  }
  return { ok: true, url, posterUrl };
}

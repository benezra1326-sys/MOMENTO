import { randomInt, randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { storageDriver, storeFile } from "./storage";
import { parseJsonObject, visionClient } from "./vision";

/**
 * Vérification du profil, comme sur les applis de rencontre : une courte vidéo guidée du visage.
 *
 * 1. La personne déclare sa date de naissance (18 ans minimum) et lance la vérification.
 *    Le serveur tire un ordre de mouvements au hasard (de face, puis gauche/droite/haut/bas mélangés,
 *    puis un geste de la main) : une vidéo préenregistrée ne peut pas le suivre.
 * 2. La caméra s'ouvre en direct (aucun import depuis la galerie) et prend une image à chaque mouvement.
 * 3. L'IA (Claude, vision) vérifie : même personne sur toutes les images et sur la photo de profil,
 *    mouvements effectués, vraie personne filmée (pas un écran ni une photo), et âge apparent.
 *    Elle valide les cas nets ; elle refuse seulement les cas nets (visage clairement mineur, autre personne).
 *    Tout le reste attend l'équipe dans /admin.
 * 4. Si la photo de profil change, le badge tombe et la vidéo déjà fournie est recomparée à la nouvelle photo.
 *
 * Âge : une image ne prouve pas la majorité. On combine la date de naissance déclarée et le refus des visages
 * clairement mineurs ; une vérification de pièce d'identité serait la seule vraie garantie.
 * Les images restent privées : elles ne sont montrées que dans l'espace de modération.
 */

export const moves = {
  front: { label: "Regarde bien la caméra", icon: "🙂" },
  left: { label: "Tourne la tête à gauche", icon: "⬅️" },
  right: { label: "Tourne la tête à droite", icon: "➡️" },
  up: { label: "Lève la tête", icon: "⬆️" },
  down: { label: "Baisse la tête", icon: "⬇️" },
} as const;

export const gestures = [
  { id: "thumb", label: "Lève le pouce", icon: "👍" },
  { id: "peace", label: "Fais un V avec deux doigts", icon: "✌️" },
  { id: "palm", label: "Montre ta main ouverte", icon: "✋" },
  { id: "ok", label: "Fais le signe OK", icon: "👌" },
] as const;

export type Step = { id: string; label: string; icon: string };

const CHALLENGE_MINUTES = 10;
const MAX_ATTEMPTS_PER_DAY = 5;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

function stepsOf(code: string): Step[] {
  return code.split(",").map((id) => {
    if (id in moves) return { id, ...moves[id as keyof typeof moves] };
    const g = gestures.find((x) => `gesture:${x.id}` === id);
    return g ? { id, label: g.label, icon: g.icon } : { id, label: id, icon: "" };
  });
}

function shuffle<T>(a: T[]) {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function ageOn(birth: Date, now = new Date()) {
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const m = now.getUTCMonth() - birth.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < birth.getUTCDate())) age--;
  return age;
}

export type VerificationState = {
  verified: boolean;
  status: "none" | "pending" | "approved" | "rejected";
  reason: string;
  hasPhoto: boolean;
  hasBirthDate: boolean;
};

export async function myVerification(viewerIn: Viewer | null): Promise<VerificationState> {
  const viewer = requireActive(viewerIn);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { photoUrl: true, photoVerifiedAt: true, birthDate: true } });
  const last = await prisma.photoVerification.findFirst({
    where: { userId: viewer.id, status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
  });
  const verified = !!u.photoVerifiedAt && !!u.photoUrl;
  const status = verified ? "approved" : last?.status === "PENDING" ? "pending" : last?.status === "REJECTED" ? "rejected" : "none";
  return { verified, status, reason: status === "rejected" ? last?.reason ?? "" : "", hasPhoto: !!u.photoUrl, hasBirthDate: !!u.birthDate };
}

const startSchema = z.object({ birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() });

/** Ouvre une demande : date de naissance (si pas encore donnée) et ordre des mouvements tiré au hasard. */
export async function startVerification(viewerIn: Viewer | null, raw: unknown = {}) {
  const viewer = requireActive(viewerIn);
  const input = startSchema.parse(raw ?? {});
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { photoUrl: true, photoVerifiedAt: true, birthDate: true } });
  if (!u.photoUrl) throw new AppError("VALIDATION", "Ajoute d'abord une photo de profil : c'est elle qu'on compare à ton visage.");
  if (u.photoVerifiedAt) throw new AppError("CONFLICT", "Ton profil est déjà vérifié.");
  let birth = u.birthDate;
  if (!birth) {
    if (!input.birthDate) throw new AppError("VALIDATION", "Indique ta date de naissance.", { birthDate: "Indique ta date de naissance." });
    birth = new Date(`${input.birthDate}T00:00:00Z`);
    const age = ageOn(birth);
    if (Number.isNaN(age) || age > 110) throw new AppError("VALIDATION", "Date de naissance invalide.", { birthDate: "Date de naissance invalide." });
    if (age < 18) throw new AppError("UNDERAGE", "Upclose est réservé aux personnes de 18 ans et plus.");
    await prisma.user.update({ where: { id: viewer.id }, data: { birthDate: birth } });
  }
  const attempts = await prisma.photoVerification.count({ where: { userId: viewer.id, createdAt: { gt: new Date(Date.now() - 86400_000) } } });
  if (attempts >= MAX_ATTEMPTS_PER_DAY) throw new AppError("RATE_LIMITED", "Trop d'essais aujourd'hui. Réessaie demain.");
  const gesture = gestures[randomInt(gestures.length)];
  const code = ["front", ...shuffle(["left", "right", "up", "down"]), `gesture:${gesture.id}`].join(",");
  const row = await prisma.photoVerification.create({
    data: { userId: viewer.id, selfieUrl: "", gesture: code, photoUrl: u.photoUrl, status: "STARTED" },
  });
  return { id: row.id, steps: stepsOf(code), expiresInSeconds: CHALLENGE_MINUTES * 60 };
}

/** Assemble les images de la vidéo en une planche (pour l'équipe de modération). */
async function contactSheet(frames: Buffer[]) {
  const cell = 360;
  const cols = 3;
  const rows = Math.ceil(frames.length / cols);
  const tiles = await Promise.all(frames.map((f) => sharp(f).resize(cell, cell, { fit: "cover" }).toBuffer()));
  return sharp({ create: { width: cols * cell, height: rows * cell, channels: 3, background: "#111" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % cols) * cell, top: Math.floor(i / cols) * cell })))
    .webp({ quality: 78 })
    .toBuffer();
}

/** Reçoit les images prises à la caméra, une par mouvement, dans l'ordre demandé. */
export async function submitVideoCheck(viewerIn: Viewer | null, id: string, files: File[]) {
  const viewer = requireActive(viewerIn);
  const row = await prisma.photoVerification.findUnique({ where: { id } });
  if (!row || row.userId !== viewer.id || row.status !== "STARTED") throw new AppError("NOT_FOUND", "Cette vérification n'existe plus. Recommence.");
  if (Date.now() - row.createdAt.getTime() > CHALLENGE_MINUTES * 60_000) {
    await prisma.photoVerification.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new AppError("VALIDATION", "Le délai est dépassé. Recommence, ça prend 20 secondes.");
  }
  const steps = stepsOf(row.gesture);
  if (files.length !== steps.length) throw new AppError("VALIDATION", "Vidéo incomplète. Recommence.");
  if (storageDriver() === "none") throw new AppError("INTERNAL", "Le stockage des médias n'est pas configuré sur ce serveur.");
  const frames: Buffer[] = [];
  for (const f of files) {
    if (!ALLOWED.has(f.type) || f.size > 6 * 1024 * 1024) throw new AppError("VALIDATION", "Image illisible. Recommence.");
    try {
      const input = Buffer.from(await f.arrayBuffer());
      const meta = await sharp(input).metadata();
      if (!meta.width || !meta.height || meta.width < 200 || meta.height < 200) throw new Error("small");
      frames.push(await sharp(input).rotate().resize(640, 640, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer());
    } catch {
      throw new AppError("VALIDATION", "Image illisible. Recommence.");
    }
  }
  const sheet = await contactSheet(frames);
  const selfieUrl = await storeFile(`verification/${randomUUID()}.webp`, sheet, "image/webp");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { photoUrl: true } });
  if (!u.photoUrl) throw new AppError("VALIDATION", "Ajoute d'abord une photo de profil.");
  await prisma.photoVerification.update({ where: { id }, data: { status: "PENDING", selfieUrl, photoUrl: u.photoUrl } });
  await autoReview(id, frames);
  return myVerification(viewer);
}

/** La photo de profil a changé : le badge tombe, et la dernière vidéo validée est recomparée à la nouvelle photo. */
export async function onProfilePhotoChanged(userId: string, newPhotoUrl: string | null) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { photoVerifiedAt: true } });
  if (!u?.photoVerifiedAt) return;
  await prisma.user.update({ where: { id: userId }, data: { photoVerifiedAt: null } });
  if (!newPhotoUrl) return;
  const last = await prisma.photoVerification.findFirst({ where: { userId, status: "APPROVED" }, orderBy: { createdAt: "desc" } });
  if (!last) return;
  const row = await prisma.photoVerification.create({
    data: { userId, selfieUrl: last.selfieUrl, gesture: last.gesture, photoUrl: newPhotoUrl, status: "PENDING", reason: "Nouvelle photo de profil" },
  });
  await autoReview(row.id, null);
}

type Verdict = {
  same_person_as_profile: boolean;
  same_person_all_frames: boolean;
  moves_done: boolean;
  live_person: boolean;
  apparent_age: number;
  clearly_minor: boolean;
  confidence: number;
  reason: string;
};

async function jpegBlock(buf: Buffer) {
  const jpeg = await sharp(buf).rotate().resize(640, 640, { fit: "inside" }).jpeg({ quality: 82 }).toBuffer();
  return { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: jpeg.toString("base64") } };
}
async function fetchBuf(url: string) {
  if (url.startsWith("/")) {
    const { readFile } = await import("node:fs/promises");
    const path = await import("node:path");
    return readFile(path.join(process.cwd(), "public", url));
  }
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

/**
 * Vérification automatique par l'IA (Claude via Vercel AI Gateway, ou clé Anthropic).
 * Valide les cas nets, refuse les cas nets, laisse tout le reste à l'équipe.
 */
async function autoReview(id: string, frames: Buffer[] | null) {
  const row = await prisma.photoVerification.findUnique({ where: { id } });
  if (!row || row.status !== "PENDING") return;
  const ai = await visionClient();
  if (!ai) return;
  const steps = stepsOf(row.gesture);
  try {
    const content: Anthropic.ContentBlockParam[] = [
      { type: "text", text: "Image A : la photo de profil choisie par le membre." },
      await jpegBlock(await fetchBuf(row.photoUrl)),
    ];
    if (frames) {
      for (let i = 0; i < frames.length; i++) {
        content.push({ type: "text", text: `Image ${i + 1} de la vidéo en direct, consigne : « ${steps[i]?.label ?? ""} ».` });
        content.push(await jpegBlock(frames[i]));
      }
    } else {
      content.push({ type: "text", text: `Planche des images de la vidéo en direct, dans l'ordre (de gauche à droite, de haut en bas) : ${steps.map((s) => s.label).join(" ; ")}.` });
      content.push(await jpegBlock(await fetchBuf(row.selfieUrl)));
    }
    content.push({
      type: "text",
      text: `Réponds UNIQUEMENT avec un objet JSON :
{"same_person_as_profile": bool, "same_person_all_frames": bool, "moves_done": bool, "live_person": bool, "apparent_age": nombre, "clearly_minor": bool, "confidence": nombre entre 0 et 1, "reason": "une phrase courte en français"}
- same_person_as_profile : le visage de la vidéo est-il clairement celui de la photo de profil ?
- same_person_all_frames : toutes les images de la vidéo montrent-elles la même personne ?
- moves_done : les mouvements demandés (tête tournée, levée, baissée, geste de la main) sont-ils visibles ?
- live_person : s'agit-il d'une vraie personne filmée (pas un écran, une photo imprimée, un masque, une image générée) ?
- apparent_age : ton estimation de l'âge apparent.
- clearly_minor : la personne paraît-elle nettement avoir moins de 18 ans ?
Sois prudent : en cas de doute, baisse la confiance.`,
    });
    const res = await ai.client.messages.create({
      model: ai.model,
      max_tokens: 800,
      system: "Tu vérifies les profils d'une application de rencontres entre adultes, comme la vérification photo des applis de rencontre. Tu compares un selfie vidéo en direct à la photo de profil. Tu réponds en JSON strict.",
      messages: [{ role: "user", content }],
    });
    const block = res.content.find((b) => b.type === "text");
    const v = block && block.type === "text" ? parseJsonObject<Verdict>(block.text) : null;
    if (!v) return;
    const why = String(v.reason ?? "").slice(0, 260);
    const conf = Number(v.confidence) || 0;
    if (v.clearly_minor && conf >= 0.8) {
      await reject(id, "auto", "La vérification n'a pas abouti : Upclose est réservé aux adultes.");
    } else if (v.same_person_as_profile === false && v.same_person_all_frames && v.live_person && conf >= 0.9) {
      await reject(id, "auto", "Le visage de la vidéo ne correspond pas à ta photo de profil. Mets une photo où l'on voit bien ton visage, puis recommence.");
    } else if (v.same_person_as_profile && v.same_person_all_frames && v.moves_done && v.live_person && !v.clearly_minor && Number(v.apparent_age) >= 18 && conf >= 0.8) {
      await approve(id, "auto", why);
    } else {
      await prisma.photoVerification.update({ where: { id }, data: { reason: `Vérification automatique incertaine : ${why}` } });
    }
  } catch (e) {
    console.error("[verification] vérification automatique en échec", (e as Error).message);
  }
}

async function approve(id: string, reviewer: string, reason: string) {
  const row = await prisma.photoVerification.update({ where: { id }, data: { status: "APPROVED", reviewedBy: reviewer, reviewedAt: new Date(), reason } });
  const u = await prisma.user.findUnique({ where: { id: row.userId }, select: { photoUrl: true } });
  // La photo a pu changer entre-temps : on ne certifie que celle qui a été comparée.
  if (u?.photoUrl !== row.photoUrl) return;
  await prisma.user.update({ where: { id: row.userId }, data: { photoVerifiedAt: new Date() } });
  await prisma.notification.create({
    data: { userId: row.userId, type: "PHOTO_VERIFIED", body: "Ton profil est vérifié : le logo Upclose apparaît sur ta photo. Tu peux publier des dispos et rejoindre des Moments." },
  });
}

async function reject(id: string, reviewer: string, reason: string) {
  await prisma.photoVerification.update({ where: { id }, data: { status: "REJECTED", reviewedBy: reviewer, reviewedAt: new Date(), reason } });
}

function requireAdmin(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  if (viewer.role !== "ADMIN") throw new AppError("FORBIDDEN", "Réservé à l'équipe de modération.");
  return viewer;
}

export async function pendingVerifications(viewerIn: Viewer | null) {
  requireAdmin(viewerIn);
  const rows = await prisma.photoVerification.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
    take: 50,
    include: { user: { select: { name: true, username: true, birthDate: true } } },
  });
  return rows.map((r) => ({
    id: r.id, selfieUrl: r.selfieUrl, photoUrl: r.photoUrl, reason: r.reason, createdAt: r.createdAt.toISOString(),
    steps: stepsOf(r.gesture),
    age: r.user.birthDate ? ageOn(r.user.birthDate) : null,
    user: { name: r.user.name, username: r.user.username },
  }));
}

export async function reviewVerification(viewerIn: Viewer | null, id: string, raw: unknown) {
  const viewer = requireAdmin(viewerIn);
  const body = (raw ?? {}) as { approve?: unknown; reason?: unknown };
  const row = await prisma.photoVerification.findUnique({ where: { id } });
  if (!row || row.status !== "PENDING") throw new AppError("NOT_FOUND", "Demande déjà traitée.");
  if (body.approve === true) await approve(id, viewer.id, "");
  else {
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 300) : "La vidéo ne correspond pas à la photo de profil.";
    await reject(id, viewer.id, reason);
  }
  return { ok: true };
}


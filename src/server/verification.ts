import { randomInt, randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { storageDriver, storeFile } from "./storage";

/**
 * Certification de la photo de profil (badge : le logo Upclose posé sur l'avatar).
 *
 * 1. La personne demande à se certifier : on tire un geste au hasard (pouce levé, V…) et on ouvre une
 *    demande valable 10 minutes.
 * 2. Elle prend un selfie EN DIRECT avec la caméra de son téléphone ou de son ordinateur, en faisant le geste.
 *    L'écran n'offre aucun import depuis la galerie.
 * 3. Le selfie est comparé à la photo de profil : automatiquement si une clé Claude est configurée
 *    (même personne, geste fait, vraie photo), sinon par l'équipe dans l'espace Modération.
 *    En cas de doute, la vérification automatique laisse la demande à l'équipe : elle ne refuse jamais seule.
 * 4. Si la photo de profil change, le badge tombe et le selfie déjà fourni est recomparé à la nouvelle photo.
 *
 * Le selfie reste privé : il n'est affiché nulle part ailleurs que dans l'espace Modération.
 */

export const gestures = [
  { id: "thumb", label: "Lève le pouce", icon: "👍" },
  { id: "peace", label: "Fais un V avec deux doigts", icon: "✌️" },
  { id: "palm", label: "Montre ta main ouverte", icon: "✋" },
  { id: "point", label: "Pointe l'index vers le haut", icon: "☝️" },
  { id: "ok", label: "Fais le signe OK", icon: "👌" },
] as const;

const CHALLENGE_MINUTES = 10;
const MAX_ATTEMPTS_PER_DAY = 5;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MODEL = "claude-opus-5-5";

export type VerificationState = {
  verified: boolean;
  status: "none" | "pending" | "approved" | "rejected";
  reason: string;
  hasPhoto: boolean;
};

export async function myVerification(viewerIn: Viewer | null): Promise<VerificationState> {
  const viewer = requireActive(viewerIn);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { photoUrl: true, photoVerifiedAt: true } });
  const last = await prisma.photoVerification.findFirst({
    where: { userId: viewer.id, status: { in: ["PENDING", "APPROVED", "REJECTED"] } },
    orderBy: { createdAt: "desc" },
  });
  const verified = !!u.photoVerifiedAt && !!u.photoUrl;
  const status = verified ? "approved" : last?.status === "PENDING" ? "pending" : last?.status === "REJECTED" ? "rejected" : "none";
  return { verified, status, reason: status === "rejected" ? last?.reason ?? "" : "", hasPhoto: !!u.photoUrl };
}

/** Ouvre une demande et tire le geste à faire sur le selfie. */
export async function startVerification(viewerIn: Viewer | null) {
  const viewer = requireActive(viewerIn);
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { photoUrl: true, photoVerifiedAt: true } });
  if (!u.photoUrl) throw new AppError("VALIDATION", "Ajoute d'abord une photo de profil : c'est elle qu'on certifie.");
  if (u.photoVerifiedAt) throw new AppError("CONFLICT", "Ta photo est déjà certifiée.");
  const attempts = await prisma.photoVerification.count({ where: { userId: viewer.id, createdAt: { gt: new Date(Date.now() - 86400_000) } } });
  if (attempts >= MAX_ATTEMPTS_PER_DAY) throw new AppError("RATE_LIMITED", "Trop d'essais aujourd'hui. Réessaie demain.");
  const gesture = gestures[randomInt(gestures.length)];
  const row = await prisma.photoVerification.create({
    data: { userId: viewer.id, selfieUrl: "", gesture: gesture.id, photoUrl: u.photoUrl, status: "STARTED" },
  });
  return { id: row.id, gesture, expiresInSeconds: CHALLENGE_MINUTES * 60 };
}

/** Reçoit le selfie pris à la caméra pour une demande ouverte. */
export async function submitSelfie(viewerIn: Viewer | null, id: string, file: File | null) {
  const viewer = requireActive(viewerIn);
  const row = await prisma.photoVerification.findUnique({ where: { id } });
  if (!row || row.userId !== viewer.id || row.status !== "STARTED") throw new AppError("NOT_FOUND", "Cette demande n'existe plus. Recommence.");
  if (Date.now() - row.createdAt.getTime() > CHALLENGE_MINUTES * 60_000) {
    await prisma.photoVerification.update({ where: { id }, data: { status: "EXPIRED" } });
    throw new AppError("VALIDATION", "Le délai est dépassé. Recommence, ça prend 20 secondes.");
  }
  if (!file || !ALLOWED.has(file.type)) throw new AppError("VALIDATION", "Selfie illisible. Recommence.");
  if (file.size > 8 * 1024 * 1024) throw new AppError("VALIDATION", "Selfie trop lourd.");
  if (storageDriver() === "none") throw new AppError("INTERNAL", "Le stockage des médias n'est pas configuré sur ce serveur.");
  const input = Buffer.from(await file.arrayBuffer());
  let out: Buffer;
  try {
    const meta = await sharp(input).metadata();
    if (!meta.width || !meta.height || meta.width < 240 || meta.height < 240) throw new Error("small");
    out = await sharp(input).rotate().resize(720, 720, { fit: "inside" }).webp({ quality: 80 }).toBuffer();
  } catch {
    throw new AppError("VALIDATION", "Selfie illisible. Recommence.");
  }
  const selfieUrl = await storeFile(`verification/${randomUUID()}.webp`, out, "image/webp");
  const u = await prisma.user.findUniqueOrThrow({ where: { id: viewer.id }, select: { photoUrl: true } });
  if (!u.photoUrl) throw new AppError("VALIDATION", "Ajoute d'abord une photo de profil.");
  await prisma.photoVerification.update({ where: { id }, data: { status: "PENDING", selfieUrl, photoUrl: u.photoUrl } });
  await autoReview(id, out);
  return myVerification(viewer);
}

/** La photo de profil a changé : le badge tombe, et le dernier selfie validé est recomparé à la nouvelle photo. */
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

type Verdict = { same_person: boolean; gesture_done: boolean; live_photo: boolean; confidence: number; reason: string };

const verdictSchema = {
  type: "object",
  properties: {
    same_person: { type: "boolean" },
    gesture_done: { type: "boolean" },
    live_photo: { type: "boolean" },
    confidence: { type: "number" },
    reason: { type: "string" },
  },
  required: ["same_person", "gesture_done", "live_photo", "confidence", "reason"],
  additionalProperties: false,
} as const;

async function imageBlock(url: string, buf: Buffer | null) {
  const data = buf ?? Buffer.from(await (await fetch(url)).arrayBuffer());
  const jpeg = await sharp(data).rotate().resize(768, 768, { fit: "inside" }).jpeg({ quality: 85 }).toBuffer();
  return { type: "image" as const, source: { type: "base64" as const, media_type: "image/jpeg" as const, data: jpeg.toString("base64") } };
}

/**
 * Vérification automatique avec Claude (si ANTHROPIC_API_KEY est configurée).
 * Elle ne fait que valider les cas nets ; tout le reste attend l'équipe.
 */
async function autoReview(id: string, selfie: Buffer | null) {
  if (!process.env.ANTHROPIC_API_KEY) return;
  const row = await prisma.photoVerification.findUnique({ where: { id } });
  if (!row || row.status !== "PENDING") return;
  const gesture = gestures.find((g) => g.id === row.gesture);
  try {
    const client = new Anthropic({ timeout: 30_000, maxRetries: 1 });
    const content = [
      { type: "text" as const, text: "Photo 1 : la photo de profil." },
      await imageBlock(row.photoUrl, null),
      { type: "text" as const, text: `Photo 2 : un selfie pris à l'instant avec la caméra. La personne devait faire ce geste : « ${gesture?.label ?? row.gesture} ».` },
      await imageBlock(row.selfieUrl, selfie),
      {
        type: "text" as const,
        text: "Réponds en JSON. same_person : les deux photos montrent-elles clairement la même personne ? gesture_done : le geste demandé est-il visible sur le selfie ? live_photo : le selfie est-il une vraie photo d'une personne (pas une photo d'écran, d'impression, une illustration ou une image générée) ? confidence : ta confiance globale entre 0 et 1. reason : une phrase courte en français.",
      },
    ];
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 1000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: verdictSchema as unknown as Record<string, unknown> } },
      system: "Tu aides une application de rencontres amicales à certifier que la photo de profil d'un membre est bien la sienne. Tu compares deux photos. Sois prudent : en cas de doute, dis-le avec une confiance basse.",
      messages: [{ role: "user", content }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (res.stop_reason === "refusal" || !block || block.type !== "text") return;
    const v = JSON.parse(block.text) as Verdict;
    if (v.same_person && v.gesture_done && v.live_photo && v.confidence >= 0.85) {
      await approve(id, "auto", String(v.reason ?? "").slice(0, 300));
    } else {
      await prisma.photoVerification.update({ where: { id }, data: { reason: `Vérification automatique incertaine : ${String(v.reason ?? "").slice(0, 280)}` } });
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
    data: { userId: row.userId, type: "PHOTO_VERIFIED", body: "Ta photo est certifiée : le logo Upclose apparaît maintenant sur ton profil." },
  });
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
    include: { user: { select: { name: true, username: true } } },
  });
  return rows.map((r) => ({
    id: r.id, selfieUrl: r.selfieUrl, photoUrl: r.photoUrl, reason: r.reason, createdAt: r.createdAt.toISOString(),
    gesture: gestures.find((g) => g.id === r.gesture) ?? { id: r.gesture, label: r.gesture, icon: "" },
    user: r.user,
  }));
}

export async function reviewVerification(viewerIn: Viewer | null, id: string, raw: unknown) {
  const viewer = requireAdmin(viewerIn);
  const body = (raw ?? {}) as { approve?: unknown; reason?: unknown };
  const row = await prisma.photoVerification.findUnique({ where: { id } });
  if (!row || row.status !== "PENDING") throw new AppError("NOT_FOUND", "Demande déjà traitée.");
  if (body.approve === true) {
    await approve(id, viewer.id, "");
  } else {
    const reason = typeof body.reason === "string" && body.reason.trim() ? body.reason.trim().slice(0, 300) : "Le selfie ne correspond pas à la photo de profil.";
    await prisma.photoVerification.update({ where: { id }, data: { status: "REJECTED", reviewedBy: viewer.id, reviewedAt: new Date(), reason } });
  }
  return { ok: true };
}

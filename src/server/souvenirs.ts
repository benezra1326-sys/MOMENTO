import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { isAllowedMediaUrl, isAllowedVideoUrl } from "@/lib/media";
import { blockedUserIds } from "./safety";
import { deleteStoredFile } from "./storage";
import { momentPhase, personSelect, toPerson } from "./mappers";
import { circleIds, circleOf, requireCircle } from "./participation";
import type { PersonSummary } from "./types";

/**
 * Souvenirs : après un Moment, l'hôte et les participants confirmés partagent une photo, une vidéo
 * ou un mot. Ils sont visibles par toute personne qui peut voir le Moment, sauf pour l'espace adulte
 * (réservé au cercle du Moment). Chacun peut retirer ses souvenirs, l'hôte peut retirer ceux du Moment.
 */

export type SouvenirDTO = {
  id: string;
  body: string;
  mediaType: "IMAGE" | "VIDEO" | "TEXT";
  mediaUrl: string | null;
  posterUrl: string | null;
  createdAt: string;
  author: PersonSummary;
  canDelete: boolean;
};

const souvenirSchema = z
  .object({
    body: z.string().trim().max(500, "500 caractères maximum.").default(""),
    mediaType: z.enum(["IMAGE", "VIDEO", "TEXT"]).default("TEXT"),
    mediaUrl: z.string().max(500).refine(isAllowedMediaUrl, "Ce média doit être envoyé depuis Upclose.").optional().nullable(),
    posterUrl: z.string().max(500).refine(isAllowedMediaUrl, "Ce média doit être envoyé depuis Upclose.").optional().nullable(),
  })
  .superRefine((v, ctx) => {
    if (v.mediaType === "TEXT" && v.body.length < 2) ctx.addIssue({ code: "custom", path: ["body"], message: "Écris quelques mots ou ajoute une photo." });
    if (v.mediaType !== "TEXT" && !v.mediaUrl) ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Ajoute ta photo ou ta vidéo." });
    if (v.mediaType === "VIDEO" && v.mediaUrl && !isAllowedVideoUrl(v.mediaUrl, productConfig.features.memberVideos)) {
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Cette vidéo doit être envoyée depuis Upclose." });
    }
  });

function assertEnabled() {
  if (!productConfig.features.posts) throw new AppError("NOT_FOUND", "Les souvenirs ne sont pas ouverts.");
}

export async function listSouvenirs(viewerIn: Viewer | null, momentId: string): Promise<SouvenirDTO[]> {
  assertEnabled();
  const viewer = requireActive(viewerIn);
  const { moment, isHost, isMember } = await circleOf(viewer, momentId);
  if (moment.isAdult && !isMember) return [];
  const blocked = await blockedUserIds(viewer.id);
  const rows = await prisma.souvenir.findMany({
    where: { momentId, ...(blocked.length ? { authorId: { notIn: blocked } } : {}) },
    include: { author: { select: personSelect } },
    orderBy: { createdAt: "asc" },
    take: 60,
  });
  return rows.map((r) => ({
    id: r.id,
    body: r.body,
    mediaType: r.mediaType,
    mediaUrl: r.mediaUrl,
    posterUrl: r.posterUrl,
    createdAt: r.createdAt.toISOString(),
    author: toPerson(r.author),
    canDelete: r.authorId === viewer.id || isHost,
  }));
}

export async function addSouvenir(viewerIn: Viewer | null, momentId: string, raw: unknown) {
  assertEnabled();
  const viewer = requireActive(viewerIn);
  const { moment } = await requireCircle(viewer, momentId);
  const phase = momentPhase(moment);
  if (phase !== "ended" && phase !== "ongoing") throw new AppError("MOMENT_NOT_OPEN", "Les souvenirs se partagent pendant ou après le Moment.");
  const input = souvenirSchema.parse(raw ?? {});
  const mine = await prisma.souvenir.count({ where: { momentId, authorId: viewer.id } });
  if (mine >= 10) throw new AppError("RATE_LIMITED", "10 souvenirs maximum par personne et par Moment.");
  const s = await prisma.souvenir.create({
    data: {
      momentId,
      authorId: viewer.id,
      body: input.body,
      mediaType: input.mediaType,
      mediaUrl: input.mediaType === "TEXT" ? null : input.mediaUrl ?? null,
      posterUrl: input.mediaType === "VIDEO" ? input.posterUrl ?? null : null,
    },
  });
  const others = (await circleIds(momentId, moment.hostId)).filter((id) => id !== viewer.id);
  if (others.length) {
    await prisma.notification.createMany({
      data: others.map((userId) => ({ userId, type: "NEW_SOUVENIR" as const, momentId, actorId: viewer.id, body: `${viewer.name} a partagé un souvenir de « ${moment.title} ».` })),
    });
  }
  return { id: s.id };
}

export async function deleteSouvenir(viewerIn: Viewer | null, momentId: string, souvenirId: string) {
  assertEnabled();
  const viewer = requireActive(viewerIn);
  const s = await prisma.souvenir.findUnique({ where: { id: souvenirId }, include: { moment: { select: { hostId: true } } } });
  if (!s || s.momentId !== momentId) throw new AppError("NOT_FOUND", "Souvenir introuvable.");
  if (s.authorId !== viewer.id && s.moment.hostId !== viewer.id) throw new AppError("FORBIDDEN", "Tu ne peux retirer que tes souvenirs.");
  await prisma.souvenir.delete({ where: { id: souvenirId } });
  for (const url of [s.mediaUrl, s.posterUrl]) if (url) await deleteStoredFile(url);
  return { deleted: true };
}

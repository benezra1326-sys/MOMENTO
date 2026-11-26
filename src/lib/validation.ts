import { z } from "zod";
import { categories, productConfig } from "@/config/product";
import { isValidTimeZone } from "./time";
import { isAllowedVideoUrl, isAllowedMediaUrl } from "./media";

const categoryIds = categories.map((c) => c.id) as [string, ...string[]];

const mediaUrl = z
  .string()
  .max(500)
  .refine(isAllowedMediaUrl, "Ce média doit être envoyé depuis Momento.");

export const textThemes = ["dusk", "ocean", "citrus", "plum", "forest", "ink"] as const;

export const momentInputSchema = z
  .object({
    title: z.string().trim().min(3, "3 caractères minimum.").max(80, "80 caractères maximum."),
    description: z.string().trim().min(10, "Décris l'ambiance en quelques mots (10 caractères min.).").max(2000),
    category: z.enum(categoryIds, { errorMap: () => ({ message: "Choisis une catégorie." }) }),
    vibeTags: z.array(z.string().trim().min(2).max(24)).max(6, "6 tags maximum.").default([]),
    mediaType: z.enum(["IMAGE", "VIDEO", "TEXT"]).default("TEXT"),
    mediaUrl: mediaUrl.optional().nullable(),
    posterUrl: mediaUrl.optional().nullable(),
    textTheme: z.enum(textThemes).optional().nullable(),
    city: z.string().trim().min(2, "Indique une ville.").max(60),
    area: z.string().trim().max(80).default(""),
    placeName: z.string().trim().max(80).default(""),
    address: z.string().trim().max(200).optional().nullable(),
    addressMembersOnly: z.boolean().default(true),
    /** Heure locale « AAAA-MM-JJTHH:MM » dans `timezone`. */
    startsAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Date de début invalide."),
    endsAtLocal: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "Date de fin invalide.")
      .optional()
      .nullable()
      .or(z.literal("")),
    timezone: z.string().refine(isValidTimeZone, "Fuseau horaire inconnu.").default("Europe/Madrid"),
    capacity: z.coerce
      .number()
      .int("Nombre entier attendu.")
      .min(1, "Au moins 1 place.")
      .max(productConfig.limits.maxCapacity, `${productConfig.limits.maxCapacity} places maximum.`),
    visibility: z.enum(["PUBLIC", "REQUEST", "INVITE_ONLY", "PRIVATE"]).default("REQUEST"),
    showAttendees: z.boolean().default(true),
    publish: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.mediaType !== "TEXT" && !v.mediaUrl) {
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Ajoute un visuel ou choisis une carte texte." });
    }
    if (v.mediaType === "VIDEO" && v.mediaUrl && !isAllowedVideoUrl(v.mediaUrl)) {
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "L'envoi de vidéos n'est pas encore ouvert : choisis une image." });
    }
    if (!productConfig.enabledVisibilities.includes(v.visibility)) {
      ctx.addIssue({ code: "custom", path: ["visibility"], message: "Ce mode d'accès n'est pas disponible." });
    }
  });

export type MomentInput = z.infer<typeof momentInputSchema>;

export const signupSchema = z.object({
  name: z.string().trim().min(2, "2 caractères minimum.").max(50),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "3 caractères minimum.")
    .max(24)
    .regex(/^[a-z0-9_.]+$/, "Lettres minuscules, chiffres, point et tiret bas uniquement."),
  email: z.string().trim().toLowerCase().email("Email invalide.").max(200),
  password: z.string().min(8, "8 caractères minimum.").max(200),
  city: z.string().trim().max(60).default(""),
  acceptAge: z.literal(true, { errorMap: () => ({ message: "Momento est réservé aux personnes majeures." }) }),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email invalide."),
  password: z.string().min(1, "Mot de passe requis."),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(50),
  bio: z.string().trim().max(300).default(""),
  city: z.string().trim().max(60).default(""),
  interests: z.array(z.string().trim().min(2).max(24)).max(10).default([]),
  photoUrl: mediaUrl.optional().nullable(),
  showPastMoments: z.boolean().default(true),
  autoplayVideos: z.boolean().default(true),
});

export const joinRequestSchema = z.object({
  message: z.string().trim().max(280).optional().nullable(),
  showOnMoment: z.boolean().default(true),
});

export const invitationSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Indique un pseudo."),
  message: z.string().trim().max(280).optional().nullable(),
});

export const cancelMomentSchema = z.object({
  reason: z.string().trim().max(280).optional().nullable(),
});

export const reportSchema = z
  .object({
    targetUsername: z.string().trim().toLowerCase().optional().nullable(),
    momentId: z.string().optional().nullable(),
    reason: z.enum(["spam", "harassment", "inappropriate", "safety", "fake", "other"]),
    details: z.string().trim().max(1000).default(""),
  })
  .refine((v) => v.targetUsername || v.momentId, "Indique un profil ou un Moment.");

export const feedQuerySchema = z.object({
  city: z.string().trim().max(60).optional(),
  category: z.enum(categoryIds).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  when: z.enum(["today", "tomorrow", "weekend", "week"]).optional(),
  sort: z.enum(["date", "recent"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

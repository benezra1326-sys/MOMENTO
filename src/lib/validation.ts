import { z } from "zod";
import { availabilitySlots, categories, productConfig } from "@/config/product";
import { isValidTimeZone } from "./time";
import { isAllowedVideoUrl, isAllowedMediaUrl } from "./media";

const categoryIds = categories.map((c) => c.id) as [string, ...string[]];

const mediaUrl = z
  .string()
  .max(500)
  .refine(isAllowedMediaUrl, "Ce média doit être envoyé depuis Upclose.");

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
    /** Moment sélectif : seuls les membres Upclose Black peuvent demander à le rejoindre. */
    blackOnly: z.boolean().default(false),
    publish: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.mediaType !== "TEXT" && !v.mediaUrl) {
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Ajoute un visuel ou choisis une carte texte." });
    }
    if (v.mediaType === "VIDEO" && v.mediaUrl && !isAllowedVideoUrl(v.mediaUrl, productConfig.features.memberVideos)) {
      ctx.addIssue({ code: "custom", path: ["mediaUrl"], message: "Cette vidéo doit être envoyée depuis Upclose." });
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
  acceptAge: z.literal(true, { errorMap: () => ({ message: "Upclose est réservé aux personnes majeures." }) }),
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
  /** Compte Instagram (facultatif), sans @ ni lien. */
  instagram: z
    .string()
    .trim()
    .transform((v) => v.replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, ""))
    .refine((v) => v === "" || /^[a-zA-Z0-9._]{1,30}$/.test(v), "Nom de compte Instagram invalide.")
    .optional()
    .nullable(),
  /** Photos du profil (6 maximum), envoyées depuis Upclose. */
  gallery: z.array(mediaUrl).max(6, "6 photos maximum.").optional(),
});

export const joinRequestSchema = z.object({
  message: z.string().trim().max(280).optional().nullable(),
  showOnMoment: z.boolean().default(true),
});

export const invitationSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Indique un pseudo."),
  message: z.string().trim().max(280).optional().nullable(),
  /** Dispo de la personne invitée à l'origine de l'invitation. */
  availabilityId: z.string().max(40).optional().nullable(),
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
  when: z.enum(["today", "tomorrow", "weekend", "later", "week"]).optional(),
  sort: z.enum(["best", "date", "recent"]).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
  /** « lat,lng » de la personne (arrondi) et rayon en km : filtre « Autour de moi ». */
  near: z.string().max(40).optional(),
  km: z.coerce.number().min(0.5).max(50).optional(),
});

export type FeedQuery = z.infer<typeof feedQuerySchema>;

const slotIds = availabilitySlots.map((s) => s.id) as [string, ...string[]];

export const availabilityInputSchema = z.object({
  /** Jour local « AAAA-MM-JJ » dans `timezone`. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisis un jour."),
  slot: z.enum(slotIds, { errorMap: () => ({ message: "Choisis un créneau." }) }).optional(),
  /** Plage libre « HH:MM » (prioritaire sur le créneau). Une fin plus tôt que le début passe au lendemain. */
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide.").optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide.").optional(),
  timezone: z.string().refine(isValidTimeZone, "Fuseau horaire inconnu.").default("Europe/Madrid"),
  city: z.string().trim().min(2, "Indique une ville.").max(60),
  area: z.string().trim().max(80).default(""),
  categories: z.array(z.enum(categoryIds)).max(4, "4 envies maximum.").default([]),
  note: z.string().trim().max(200, "200 caractères maximum.").default(""),
});

export const availabilityUpdateSchema = availabilityInputSchema.partial().extend({ hidden: z.boolean().optional() });

export const availabilityQuerySchema = z.object({
  city: z.string().trim().max(60).optional(),
  when: z.enum(["today", "tomorrow", "weekend", "later", "week"]).optional(),
  /** Créneau de la journée : garde les dispos qui le chevauchent. */
  slot: z.enum(["morning", "lunch", "afternoon", "evening"]).optional(),
  near: z.string().max(40).optional(),
  km: z.coerce.number().min(0.5).max(50).optional(),
});

/**
 * Décisions produit encore ouvertes (voir docs/DECISIONS.md).
 * Tout ce qui n'est pas validé par l'équipe produit est isolé ici,
 * pour être changé sans toucher au code des parcours.
 */
import type { MomentVisibility } from "@prisma/client";

function flag(name: string, fallback: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return fallback;
  return v === "true" || v === "1";
}

export const productConfig = {
  appName: "Upclose",
  tagline: "La vie est plus belle de près.",
  mantra: "Life looks better up close.",

  /** Décision ouverte n°1 : ville pilote. Marbella n'est qu'un exemple historique. */
  pilotCity: process.env.PILOT_CITY || "Marbella",
  /** Fuseau par défaut pour les nouveaux Moments et les filtres « aujourd'hui / ce week-end ». */
  defaultTimezone: process.env.DEFAULT_TIMEZONE || "Europe/Madrid",

  /** Villes proposées dans les filtres et le formulaire (la saisie libre reste possible). */
  cities: ["Marbella", "Málaga", "Madrid", "Barcelona", "Paris", "Tel Aviv"],

  /** Décision ouverte n°3 : quels modes d'accès un hôte peut choisir. */
  enabledVisibilities: ["REQUEST", "PUBLIC", "INVITE_ONLY", "PRIVATE"] as MomentVisibility[],

  features: {
    /** Disponibilités (« je suis libre samedi soir ») : ouvertes en v2, à la demande d'Avishay. */
    availability: flag("FEATURE_AVAILABILITY", true),
    /** Vidéos envoyées par les membres (Vercel Blob, envoi direct depuis le navigateur). */
    memberVideos: flag("FEATURE_MEMBER_VIDEOS", true),
    /** Souvenirs après un Moment vécu (photo, vidéo, mot). */
    posts: flag("FEATURE_POSTS", true),
    /** Discussion liée à chaque Moment (hôte et participants acceptés). */
    messaging: flag("FEATURE_MESSAGING", true),
    /** Espace adulte 18+ (opt-in, caché par défaut). */
    adultSpace: flag("FEATURE_ADULT_SPACE", true),
    /** Notes après un Moment vécu, utilisées dans le classement. */
    ratings: flag("FEATURE_RATINGS", true),
    /** Décision ouverte n°5 : QR événementiel. */
    qr: flag("FEATURE_QR", false),
  },

  /** Ranking du feed : « best » (Pour toi, explicable : dispo, envies, proximité, notes, places réelles). */
  defaultSort: "best" as "best" | "date" | "recent",

  limits: {
    /** Anti-spam : invitations envoyées par un hôte par heure. */
    invitesPerHour: 30,
    /** Anti-spam : demandes pour rejoindre par utilisateur et par heure. */
    requestsPerHour: 20,
    /** Signalements par utilisateur et par heure. */
    reportsPerHour: 10,
    /** E-mails de vérification ou de réinitialisation envoyés par compte et par heure. */
    authEmailsPerHour: 3,
    maxCapacity: 200,
    feedPageSize: 12,
    /** Images envoyées par utilisateur et par heure. */
    uploadsPerHour: 30,
    /** Sous la limite de 4,5 Mo des fonctions Vercel ; le navigateur réduit les photos plus lourdes avant l'envoi. */
    uploadMaxBytes: 4 * 1024 * 1024,
    uploadMaxDimension: 6000,
    /** Vidéos des membres : envoyées directement du navigateur vers le stockage. */
    videoMaxBytes: 60 * 1024 * 1024,
    videoMaxSeconds: 60,
    videoUploadsPerHour: 6,
    /** Disponibilités actives en même temps par personne, et horizon de publication. */
    availabilitiesActiveMax: 3,
    availabilityDaysAhead: 14,
    availabilitiesPerDay: 10,
    /** Discussion : messages par personne et par heure, longueur max. */
    messagesPerHour: 60,
    messageMaxLength: 1000,
    /** Notes : délai pour noter après la fin, et nombre minimum d'avis avant affichage ou effet sur le classement. */
    ratingWindowDays: 14,
    ratingMinCount: 3,
    /** Assistant IA : demandes par personne et par heure. */
    aiPerHour: 30,
  },
} as const;

export const categories = [
  { id: "dinner", label: "Dîner" },
  { id: "drinks", label: "Apéro & verres" },
  { id: "sunset", label: "Sunset" },
  { id: "coffee", label: "Café" },
  { id: "brunch", label: "Brunch" },
  { id: "gallery", label: "Galerie & expo" },
  { id: "walk", label: "Balade" },
  { id: "sport", label: "Sport" },
  { id: "party", label: "Soirée" },
  { id: "boat", label: "Bateau" },
  { id: "culture", label: "Concert & culture" },
  { id: "travel", label: "Voyage & escapade" },
  { id: "networking", label: "Networking" },
  { id: "date", label: "Tête-à-tête" },
  { id: "adult", label: "18+" },
  { id: "other", label: "Autre" },
] as const;

/** Catégorie de l'espace adulte : visible et utilisable seulement après opt-in 18+. */
export const ADULT_CATEGORY = "adult";

/** Catégories qu'une personne peut voir et choisir (l'espace adulte uniquement si elle l'a activé). */
export function visibleCategories(showAdult: boolean) {
  return categories.filter((c) => showAdult || c.id !== ADULT_CATEGORY);
}

export type CategoryId = (typeof categories)[number]["id"];

export function categoryLabel(id: string): string {
  return categories.find((c) => c.id === id)?.label ?? "Autre";
}

export const vibeSuggestions = [
  "chill", "festif", "rencontres", "créatif", "sportif", "gourmand",
  "en plein air", "intimiste", "networking", "musique", "lent", "spontané",
];

export const visibilityInfo: Record<MomentVisibility, { label: string; help: string }> = {
  REQUEST: {
    label: "Sur demande",
    help: "Visible dans le feed. Chaque personne demande à rejoindre, tu acceptes ou refuses.",
  },
  PUBLIC: {
    label: "Ouvert",
    help: "Visible dans le feed. La place est confirmée tout de suite, tant qu'il en reste.",
  },
  INVITE_ONLY: {
    label: "Sur invitation",
    help: "Absent du feed. Seules les personnes que tu invites le voient et peuvent répondre.",
  },
  PRIVATE: {
    label: "Privé (lien)",
    help: "Absent du feed. Visible uniquement avec le lien ; tu acceptes ou refuses chaque demande.",
  },
};

/** Créneaux d'une disponibilité, en heure locale. */
export const availabilitySlots = [
  { id: "morning", label: "Matin", start: "09:00", end: "12:00" },
  { id: "lunch", label: "Midi", start: "12:00", end: "15:00" },
  { id: "afternoon", label: "Après-midi", start: "15:00", end: "19:00" },
  { id: "evening", label: "Soir", start: "19:00", end: "23:30" },
  { id: "day", label: "Toute la journée", start: "09:00", end: "23:30" },
] as const;

export type AvailabilitySlotId = (typeof availabilitySlots)[number]["id"];

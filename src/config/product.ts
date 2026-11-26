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
  appName: "Momento",
  tagline: "Moins de scroll. Plus de moments vécus.",
  mantra: "Don't scroll life. Live it.",

  /** Décision ouverte n°1 : ville pilote. Marbella n'est qu'un exemple historique. */
  pilotCity: process.env.PILOT_CITY || "Marbella",
  /** Fuseau par défaut pour les nouveaux Moments et les filtres « aujourd'hui / ce week-end ». */
  defaultTimezone: process.env.DEFAULT_TIMEZONE || "Europe/Madrid",

  /** Villes proposées dans les filtres et le formulaire (la saisie libre reste possible). */
  cities: ["Marbella", "Málaga", "Madrid", "Barcelona", "Paris", "Tel Aviv"],

  /** Décision ouverte n°3 : quels modes d'accès un hôte peut choisir. */
  enabledVisibilities: ["REQUEST", "PUBLIC", "INVITE_ONLY", "PRIVATE"] as MomentVisibility[],

  features: {
    /** Décision ouverte n°2 : Disponibilités au MVP ? Désactivé par défaut. */
    availability: flag("FEATURE_AVAILABILITY", false),
    /** Souvenirs/posts : phase 5. */
    posts: flag("FEATURE_POSTS", false),
    /** Décision ouverte n°4 : messagerie intégrée. */
    messaging: flag("FEATURE_MESSAGING", false),
    /** Décision ouverte n°5 : QR événementiel. */
    qr: flag("FEATURE_QR", false),
  },

  /** Ranking du feed : « date » (chronologique) par défaut, explicable. */
  defaultSort: "date" as "date" | "recent",

  limits: {
    /** Anti-spam : invitations envoyées par un hôte par heure. */
    invitesPerHour: 30,
    /** Anti-spam : demandes pour rejoindre par utilisateur et par heure. */
    requestsPerHour: 20,
    /** Signalements par utilisateur et par heure. */
    reportsPerHour: 10,
    maxCapacity: 200,
    feedPageSize: 12,
    uploadMaxBytes: 8 * 1024 * 1024,
    uploadMaxDimension: 6000,
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
  { id: "other", label: "Autre" },
] as const;

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

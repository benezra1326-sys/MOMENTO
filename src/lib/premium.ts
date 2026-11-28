/** Offres payantes : Upclose+ et Upclose Black. Ce qui est gratuit le reste pour tout le monde. */
export type PlanId = "plus" | "black";
export type Interval = "month" | "year";
export type Tier = "free" | PlanId;

/** Prix en centimes, réglables sans changer le code (variables NEXT_PUBLIC_PRICE_*). Annuel par défaut : −30 %. */
function cents(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isInteger(v) && v > 0 ? v : fallback;
}
const yearly = (month: number) => Math.round((month * 12 * 0.7) / 10) * 10;
const plusMonth = cents("NEXT_PUBLIC_PRICE_PLUS_MONTH", 499);
const blackMonth = cents("NEXT_PUBLIC_PRICE_BLACK_MONTH", 2499);

export const plans: Record<PlanId, { name: string; month: number; year: number; boostsPerMonth: number }> = {
  plus: { name: "Upclose+", month: plusMonth, year: cents("NEXT_PUBLIC_PRICE_PLUS_YEAR", yearly(plusMonth)), boostsPerMonth: 1 },
  black: { name: "Upclose Black", month: blackMonth, year: cents("NEXT_PUBLIC_PRICE_BLACK_YEAR", yearly(blackMonth)), boostsPerMonth: 4 },
};

/** Limites de chaque offre, appliquées côté serveur. */
export const tierLimits: Record<Tier, { activeAvailabilities: number; activeMoments: number; aiPer30Days: number; boostsPerMonth: number }> = {
  free: { activeAvailabilities: 1, activeMoments: 3, aiPer30Days: 5, boostsPerMonth: 0 },
  plus: { activeAvailabilities: 5, activeMoments: Infinity, aiPer30Days: 50, boostsPerMonth: 1 },
  black: { activeAvailabilities: 5, activeMoments: Infinity, aiPer30Days: 50, boostsPerMonth: 4 },
};

export const premiumPlan = {
  /** Offre gratuite : Moments à venir publiés en même temps. */
  freeActiveMoments: tierLimits.free.activeMoments,
  /** Offre gratuite : brouillons écrits par l'assistant IA sur 30 jours. */
  freeAiPerMonth: tierLimits.free.aiPer30Days,
  /** Durée d'un boost. */
  boostHours: 24,
} as const;

export function priceLabel(cents: number) {
  return `${(cents / 100).toFixed(2).replace(".", ",")} €`;
}

export function isPlanId(v: unknown): v is PlanId {
  return v === "plus" || v === "black";
}

type Cell = string | boolean;
const L = tierLimits;
export const planFeatures: { label: string; free: Cell; plus: Cell; black: Cell }[] = [
  { label: "Parcourir et ouvrir les Moments", free: "Illimité", plus: "Illimité", black: "Illimité" },
  { label: "Demander à rejoindre des Moments", free: "Illimité", plus: "Illimité", black: "Illimité" },
  { label: "Discussion, notes, profil, sécurité", free: true, plus: true, black: true },
  { label: "Dispos actives en même temps", free: `${L.free.activeAvailabilities}`, plus: `${L.plus.activeAvailabilities}`, black: `${L.black.activeAvailabilities}` },
  { label: "Moments à venir en même temps", free: `${L.free.activeMoments}`, plus: "Illimité", black: "Illimité" },
  { label: "Assistant de création (30 jours)", free: `${L.free.aiPer30Days}`, plus: `${L.plus.aiPer30Days}`, black: `${L.black.aiPer30Days}` },
  { label: "Boost « Mis en avant » 24 h", free: false, plus: "1 par mois", black: "4 par mois" },
  { label: "Qui a vu tes Moments et ton profil", free: false, plus: false, black: true },
  { label: "Personnes pour toi (suggestions)", free: false, plus: false, black: true },
  { label: "Moments réservés Black", free: false, plus: false, black: true },
  { label: "Thème noir et or + icône Black (au choix)", free: false, plus: false, black: true },
  { label: "Badge sur ton profil", free: false, plus: "Upclose+", black: "Black" },
];

/** Fonctions annoncées mais pas encore développées : jamais présentées comme incluses. */
export const comingSoon: Record<PlanId, string[]> = {
  plus: ["Filtres avancés", "Alertes enregistrées"],
  black: ["Moments récurrents", "Co-hôte", "Liste d'attente", "Tableau de suivi de tes Moments"],
};

/** Avantages de chaque offre, tels qu'ils sont réellement actifs dans l'app. */
export const planPerks: Record<Tier, { title: string; text: string }[]> = {
  free: [
    { title: "Parcourir et rejoindre sans limite", text: "Ouvre toutes les fiches et demande ta place, sans quota." },
    { title: `${L.free.activeAvailabilities} dispo active à la fois`, text: "Modifie-la ou supprime-la quand tu veux. Dès qu'elle expire, publie la suivante." },
    { title: `${L.free.activeMoments} Moments à venir à la fois`, text: "Crée tes propres Moments, jusqu'à 3 publiés en même temps." },
    { title: `Assistant de création : ${L.free.aiPer30Days} fois sur 30 jours`, text: "Il écrit ton Moment ou ta dispo à partir d'une idée." },
    { title: "Discussion, notes, profil et sécurité", text: "Tout ce qui sert à se rencontrer en vrai reste gratuit." },
  ],
  plus: [
    { title: `Jusqu'à ${L.plus.activeAvailabilities} dispos actives`, text: "Dis quand tu es libre sur plusieurs jours ou créneaux à la fois." },
    { title: "Moments à venir illimités", text: "Publie autant de Moments que tu veux, au-delà de 3." },
    { title: `Assistant de création : ${L.plus.aiPer30Days} fois sur 30 jours`, text: "Dix fois plus que l'offre gratuite." },
    { title: "1 boost « Mis en avant » par mois", text: "Ton Moment passe en tête du fil pendant 24 h, avec la mention « Mis en avant »." },
    { title: "Badge Upclose+", text: "Affiché sur ton profil." },
  ],
  black: [
    { title: "Tout Upclose+", text: `${L.black.activeAvailabilities} dispos actives, Moments illimités, assistant ${L.black.aiPer30Days} fois sur 30 jours.` },
    { title: "4 boosts « Mis en avant » par mois", text: "Quatre fois plus de visibilité qu'Upclose+." },
    { title: "Qui a vu tes Moments et ton profil", text: "Découvre qui s'intéresse à toi, et invite-les." },
    { title: "Personnes pour toi", text: "Des profils choisis pour toi : mêmes envies, même ville, bien notés." },
    { title: "Moments réservés Black", text: "Crée et rejoins des Moments sélectifs, ouverts seulement aux membres Black." },
    { title: "Thème noir et or, icône Black", text: "Toute l'app passe en noir et or si tu le veux. Tu peux garder le thème classique." },
    { title: "Badge Black", text: "Affiché sur ton profil." },
  ],
};

type PremiumFields = { premiumUntil?: Date | string | null; premiumPlan?: string | null };

export function isPremium(u: PremiumFields | null | undefined, now = new Date()): boolean {
  if (!u?.premiumUntil) return false;
  return new Date(u.premiumUntil).getTime() > now.getTime();
}

export function tierOf(u: PremiumFields | null | undefined, now = new Date()): Tier {
  if (!isPremium(u, now)) return "free";
  return u?.premiumPlan === "black" ? "black" : "plus";
}

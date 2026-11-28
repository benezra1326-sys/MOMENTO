/** Offres payantes : Upclose+ et Upclose Black. Ce qui est gratuit le reste pour tout le monde. */
export type PlanId = "plus" | "black";
export type Interval = "month" | "year";
export type Tier = "free" | PlanId;

export const plans: Record<PlanId, { name: string; month: number; year: number; boostsPerMonth: number }> = {
  plus: { name: "Upclose+", month: 999, year: 8390, boostsPerMonth: 1 },
  black: { name: "Upclose Black", month: 2499, year: 20990, boostsPerMonth: 4 },
};

export const premiumPlan = {
  /** Offre gratuite : Moments à venir publiés en même temps. */
  freeActiveMoments: 3,
  /** Offre gratuite : brouillons écrits par l'assistant IA sur 30 jours. */
  freeAiPerMonth: 5,
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
export const planFeatures: { label: string; free: Cell; plus: Cell; black: Cell }[] = [
  { label: "Rejoindre des Moments", free: "Illimité", plus: "Illimité", black: "Illimité" },
  { label: "Dispos, discussion, notes, sécurité", free: true, plus: true, black: true },
  { label: "Moments à venir en même temps", free: `${premiumPlan.freeActiveMoments}`, plus: "Illimité", black: "Illimité" },
  { label: "Assistant IA pour créer", free: `${premiumPlan.freeAiPerMonth} par mois`, plus: "Illimité", black: "Illimité" },
  { label: "Boost « Mis en avant » 24 h", free: false, plus: "1 par mois", black: "4 par mois" },
  { label: "Qui a vu tes Moments et ton profil", free: false, plus: false, black: true },
  { label: "Personnes pour toi (suggestions)", free: false, plus: false, black: true },
  { label: "Moments réservés Black", free: false, plus: false, black: true },
  { label: "Badge sur ton profil", free: false, plus: "Upclose+", black: "Black" },
];

type PremiumFields = { premiumUntil?: Date | string | null; premiumPlan?: string | null };

export function isPremium(u: PremiumFields | null | undefined, now = new Date()): boolean {
  if (!u?.premiumUntil) return false;
  return new Date(u.premiumUntil).getTime() > now.getTime();
}

export function tierOf(u: PremiumFields | null | undefined, now = new Date()): Tier {
  if (!isPremium(u, now)) return "free";
  return u?.premiumPlan === "black" ? "black" : "plus";
}

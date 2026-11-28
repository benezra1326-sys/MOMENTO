/** Offre Upclose+ : ce qui est gratuit, ce qui est réservé aux membres Upclose+. */
export const premiumPlan = {
  name: "Upclose+",
  priceCents: 499,
  priceLabel: "4,99 €",
  period: "mois",
  /** Offre gratuite : Moments à venir publiés en même temps. */
  freeActiveMoments: 3,
  /** Offre gratuite : brouillons écrits par l'assistant IA sur 30 jours. */
  freeAiPerMonth: 5,
  /** Durée d'un boost. */
  boostHours: 24,
} as const;

export const planFeatures: { label: string; free: string | boolean; plus: string | boolean }[] = [
  { label: "Rejoindre des Moments", free: "Illimité", plus: "Illimité" },
  { label: "Proposer tes dispos", free: true, plus: true },
  { label: "Discussion du Moment et notes", free: true, plus: true },
  { label: "Moments à venir en même temps", free: `${premiumPlan.freeActiveMoments}`, plus: "Illimité" },
  { label: "Assistant IA pour créer", free: `${premiumPlan.freeAiPerMonth} par mois`, plus: "Illimité" },
  { label: "Boost : ton Moment « Mis en avant » dans le feed de ta ville 24 h", free: false, plus: true },
  { label: "Tes demandes en premier chez l'hôte", free: false, plus: true },
  { label: "Badge Upclose+ sur ton profil", free: false, plus: true },
];

export function isPremium(u: { premiumUntil?: Date | string | null } | null | undefined, now = new Date()): boolean {
  if (!u?.premiumUntil) return false;
  return new Date(u.premiumUntil).getTime() > now.getTime();
}

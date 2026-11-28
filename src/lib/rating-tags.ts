/**
 * Notation après un Moment, façon « après la course » : une note en étoiles, puis des qualités en un geste.
 * Partagé entre l'écran de notation (client) et le serveur (validation, agrégats du profil).
 *
 * - Les qualités positives construisent les « points forts » affichés sur le profil (sympathie, ponctualité…).
 * - Les remarques (négatives) ne sont jamais affichées publiquement : elles baissent le critère concerné
 *   et servent à la modération. On valorise, on n'humilie pas.
 */

export type RatingTag = {
  id: string;
  label: string;
  /** Emoji affiché sur la puce. */
  icon: string;
  positive: boolean;
  /** Réservé à la notation de l'hôte. */
  hostOnly?: boolean;
  /** Critère historique influencé par cette qualité (moyennes par critère). */
  criterion?: "punctuality" | "ambiance" | "respect" | "organisation" | "accuracy";
};

export const ratingTags: RatingTag[] = [
  { id: "sympa", label: "Sympathique", icon: "😊", positive: true },
  { id: "ponctuel", label: "Ponctuel·le", icon: "⏰", positive: true, criterion: "punctuality" },
  { id: "ambiance", label: "Super ambiance", icon: "✨", positive: true, criterion: "ambiance" },
  { id: "respect", label: "Respectueux·se", icon: "🤝", positive: true, criterion: "respect" },
  { id: "drole", label: "Drôle", icon: "😂", positive: true },
  { id: "ecoute", label: "À l'écoute", icon: "👂", positive: true },
  { id: "bienveillant", label: "Bienveillant·e", icon: "💛", positive: true },
  { id: "organise", label: "Bien organisé", icon: "📋", positive: true, hostOnly: true, criterion: "organisation" },
  { id: "fidele", label: "Fidèle à l'annonce", icon: "🎯", positive: true, hostOnly: true, criterion: "accuracy" },
  { id: "accueil", label: "Accueil au top", icon: "🏡", positive: true, hostOnly: true },
  { id: "lieu", label: "Lieu bien choisi", icon: "📍", positive: true, hostOnly: true },

  { id: "retard", label: "En retard", icon: "🐢", positive: false, criterion: "punctuality" },
  { id: "distant", label: "Distant·e", icon: "🧊", positive: false, criterion: "ambiance" },
  { id: "irrespect", label: "Manque de respect", icon: "⚠️", positive: false, criterion: "respect" },
  { id: "desorganise", label: "Mal organisé", icon: "🌀", positive: false, hostOnly: true, criterion: "organisation" },
  { id: "different", label: "Différent de l'annonce", icon: "🔀", positive: false, hostOnly: true, criterion: "accuracy" },
];

export const ratingTagIds = new Set(ratingTags.map((t) => t.id));
export const positiveTags = ratingTags.filter((t) => t.positive);
export const tagById = new Map(ratingTags.map((t) => [t.id, t]));

/** Libellé affiché sous les étoiles. */
export const starWords = ["", "Décevant", "Bof", "Correct", "Très bien", "Génial !"] as const;

/** La question posée après les étoiles. */
export function tagQuestion(stars: number, name: string) {
  if (stars >= 4) return { title: `Qu'est-ce qui t'a plu chez ${name} ?`, hint: "Choisis autant de qualités que tu veux." };
  return { title: "Qu'est-ce qui aurait pu être mieux ?", hint: "Tes remarques restent privées : personne ne les voit sur le profil." };
}

/** Puces proposées selon la note : qualités d'abord si la note est bonne, remarques d'abord sinon. */
export function tagsFor(stars: number, isHost: boolean) {
  const fit = ratingTags.filter((t) => !t.hostOnly || isHost);
  const pos = fit.filter((t) => t.positive);
  const neg = fit.filter((t) => !t.positive);
  if (stars >= 4) return pos;
  if (stars === 3) return [...neg, ...pos];
  return neg;
}

/**
 * Valeurs des anciens critères (1 à 5) déduites des étoiles et des remarques :
 * une remarque sur un critère le ramène à 2 au plus, « manque de respect » à 1.
 */
export function criteriaFromStars(stars: number, tags: string[], isHost: boolean) {
  const cap = (crit: RatingTag["criterion"], base: number) => {
    const neg = tags.map((id) => tagById.get(id)).filter((t) => t && !t.positive && t.criterion === crit);
    if (!neg.length) return base;
    return crit === "respect" ? 1 : Math.min(base, 2);
  };
  return {
    punctuality: cap("punctuality", stars),
    ambiance: cap("ambiance", stars),
    respect: cap("respect", stars),
    organisation: isHost ? cap("organisation", stars) : null,
    accuracy: isHost ? cap("accuracy", stars) : null,
  };
}

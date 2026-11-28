import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { requireActive, type Viewer } from "@/lib/auth";
import { ADULT_CATEGORY, availabilitySlots, categories, productConfig, vibeSuggestions } from "@/config/product";
import { utcToZonedLocal } from "@/lib/time";
import { canSeeAdult } from "./moments";
import { currentTier } from "./billing";
import { premiumPlan, tierLimits } from "@/lib/premium";

/**
 * Assistant de création : une phrase (« dîner chic samedi soir à Marbella, on est 4 ») devient
 * un brouillon structuré de Moment ou de dispo, que la personne relit et corrige avant de publier.
 * Rien n'est publié automatiquement.
 *
 * Deux moteurs : Claude (si ANTHROPIC_API_KEY est configurée) et, toujours disponible, un analyseur
 * à règles en français. Si Claude échoue ou refuse, on retombe sur les règles sans bloquer.
 */

export type Draft = {
  kind: "moment" | "availability";
  title: string;
  description: string;
  category: string;
  city: string;
  area: string;
  /** Jour local AAAA-MM-JJ (null si non précisé). */
  date: string | null;
  /** Heure locale HH:MM pour un Moment (null si non précisée). */
  time: string | null;
  slot: string | null;
  capacity: number | null;
  vibeTags: string[];
  note: string;
  /** Moteur utilisé, affiché honnêtement à la personne. */
  engine: "claude" | "rules";
};

const inputSchema = z.object({
  text: z.string().trim().min(4, "Décris ton envie en une phrase.").max(600, "600 caractères maximum."),
  kind: z.enum(["moment", "availability", "auto"]).default("auto"),
});

const MODEL = "claude-opus-5-5";

// ——— Analyseur à règles (français, tolère l'anglais simple) ———

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const categoryWords: [string, string[]][] = [
  [ADULT_CATEGORY, ["libertin", "echangis", "club libertin", "couple ouvert", "bdsm", "coquin"]],
  ["dinner", ["diner", "dinner", "restaurant", "resto", "tapas", "manger", "gastronom", "degustation"]],
  ["drinks", ["verre", "apero", "cocktail", "bar", "drink", "biere", "vin "]],
  ["sunset", ["sunset", "coucher du soleil", "rooftop"]],
  ["coffee", ["cafe", "coffee"]],
  ["brunch", ["brunch", "petit dej", "petit-dej"]],
  ["gallery", ["expo", "galerie", "musee", "art "]],
  ["walk", ["balade", "promenade", "randonnee", "rando", "marche"]],
  ["sport", ["sport", "padel", "tennis", "footing", "running", "yoga", "foot", "surf", "velo", "gym", "match"]],
  ["party", ["soiree", "fete", "party", "club", "danser", "boite"]],
  ["boat", ["bateau", "voilier", "catamaran", "boat"]],
  ["culture", ["concert", "theatre", "cine", "festival", "spectacle", "opera", "culture"]],
  ["travel", ["voyage", "road trip", "roadtrip", "escapade", "week-end a", "partir a", "vacances", "tokyo", "lisbonne"]],
  ["networking", ["networking", "entrepreneur", "business", "pro ", "startup", "dejeuner d'affaires"]],
  ["date", ["tete-a-tete", "tete a tete", "rencontre romantique", "date ", "en amoureux", "romantique"]],
];

const weekdays = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function addDays(ymd: string, n: number) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function parseWithRules(text: string, opts: { now?: Date; tz?: string; defaultCity?: string; kind?: "moment" | "availability" | "auto" } = {}): Draft {
  const now = opts.now ?? new Date();
  const tz = opts.tz ?? productConfig.defaultTimezone;
  const t = ` ${norm(text)} `;
  const today = utcToZonedLocal(now, tz).slice(0, 10);
  const todayIdx = new Date(`${today}T12:00:00Z`).getUTCDay();

  // Type : dispo (« je suis libre / dispo / j'ai envie ») ou Moment (« je propose / j'organise / on cherche »).
  let kind: Draft["kind"] = "moment";
  if (opts.kind && opts.kind !== "auto") kind = opts.kind;
  else if (/\b(dispo|disponible|libre|j'ai envie|envie de|qui veut|quelqu'un pour)\b/.test(t) && !/\b(je propose|j'organise|on organise|j'invite)\b/.test(t)) kind = "availability";

  // Jour.
  let date: string | null = null;
  if (/aujourd'hui|ce soir|cet apres|ce midi|ce matin|maintenant|dans une heure|tonight|today/.test(t)) date = today;
  else if (/apres-demain|apres demain/.test(t)) date = addDays(today, 2);
  else if (/demain|tomorrow/.test(t)) date = addDays(today, 1);
  else if (/ce week-end|ce weekend|this weekend/.test(t)) date = addDays(today, (6 - todayIdx + 7) % 7);
  else {
    const wd = weekdays.findIndex((w) => t.includes(` ${w}`));
    if (wd >= 0) date = addDays(today, ((wd - todayIdx + 7) % 7) || 7);
    const m = t.match(/\b(\d{1,2})[/.](\d{1,2})\b/);
    if (!date && m) {
      const y = Number(today.slice(0, 4));
      const cand = `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
      date = cand < today ? `${y + 1}-${cand.slice(5)}` : cand;
    }
  }

  // Heure et créneau.
  let time: string | null = null;
  const hm = t.match(/\b(\d{1,2})\s?(?:h|:)\s?(\d{2})?\b/);
  if (hm && Number(hm[1]) <= 23) time = `${hm[1].padStart(2, "0")}:${(hm[2] ?? "00").padStart(2, "0")}`;
  let slot: string | null = null;
  if (/matin|morning|petit dej/.test(t)) slot = "morning";
  else if (/midi|dejeuner|lunch|brunch/.test(t)) slot = "lunch";
  else if (/apres-midi|aprem|afternoon/.test(t)) slot = "afternoon";
  else if (/soir|soiree|diner|night|tonight|nuit/.test(t)) slot = "evening";
  else if (/toute la journee|all day/.test(t)) slot = "day";
  if (time && !slot) {
    const h = Number(time.slice(0, 2));
    slot = h < 12 ? "morning" : h < 15 ? "lunch" : h < 19 ? "afternoon" : "evening";
  }
  if (!time && slot) time = { morning: "10:00", lunch: "13:00", afternoon: "16:00", evening: "20:00", day: "18:00" }[slot] ?? null;

  // Catégorie.
  let category = "other";
  for (const [id, words] of categoryWords) {
    if (words.some((w) => t.includes(w))) {
      category = id;
      break;
    }
  }

  // Ville et quartier.
  const city = productConfig.cities.find((c) => t.includes(norm(c))) ?? opts.defaultCity ?? productConfig.pilotCity;
  const areaMatch = text.match(/(?:^|\s)(?:à|a|au|vers|quartier)\s+((?:Puerto Banús|Golden Mile|Casco Antiguo|Nueva Andalucía|Soho|Malasaña|Paseo Marítimo|[A-Z][\wÀ-ÿ'-]+(?:\s[A-Z][\wÀ-ÿ'-]+)?))/);
  const area = areaMatch && norm(areaMatch[1]) !== norm(city) && !productConfig.cities.some((c) => norm(c) === norm(areaMatch[1])) ? areaMatch[1] : "";

  // Places : « on est 4 » → il reste des places ; « pour 6 » / « 3 personnes » → capacité.
  let capacity: number | null = null;
  const forN = t.match(/\b(?:pour|a|à)\s(\d{1,2})\b(?!\s?h)/) ?? t.match(/\b(\d{1,2})\s(?:personnes|places|invites|participants|people)\b/);
  const weAre = t.match(/\bon est (\d{1,2})\b/);
  const left = t.match(/\breste (\d{1,2}) places?\b/);
  if (left) capacity = Number(left[1]);
  else if (forN) capacity = Math.max(1, Number(forN[1]) - 1);
  else if (weAre) capacity = 2;
  if (capacity !== null) capacity = Math.min(capacity, productConfig.limits.maxCapacity);

  // Ambiance.
  const vibeMap: [string, string[]][] = [
    ["chill", ["chill", "tranquille", "cool", "detente"]],
    ["festif", ["festif", "fete", "danser"]],
    ["intimiste", ["intime", "intimiste", "petit comite", "chic", "elegant"]],
    ["networking", ["networking", "entrepreneur", "business"]],
    ["en plein air", ["plage", "plein air", "dehors", "terrasse"]],
    ["gourmand", ["gourmand", "gastronom", "degustation", "foodie"]],
    ["spontané", ["dans une heure", "maintenant", "spontane", "ce soir"]],
    ["rencontres", ["nouvelles personnes", "gens interessants", "rencontrer", "inconnus"]],
  ];
  const vibeTags = vibeMap.filter(([, w]) => w.some((x) => t.includes(x))).map(([v]) => v).filter((v) => vibeSuggestions.includes(v)).slice(0, 4);

  const label = categories.find((c) => c.id === category)?.label ?? "Moment";
  const clean = text.trim().replace(/\s+/g, " ");
  // Titre : la phrase sans les précisions déjà rangées ailleurs (jour, heure, nombre de personnes).
  const days = "aujourd'hui|ce soir|cet après-midi|ce matin|demain(?: soir| matin| midi| après-midi)?|après-demain|ce week-end|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche";
  const stripped = clean
    .replace(new RegExp(`\\b(?:${days})(?: (?:soir|matin|midi|après-midi))?\\b`, "gi"), " ")
    .replace(/\b(?:vers|à|a|dès|pour)?\s*\d{1,2}\s*(?:h|heures?|:)\s*\d{0,2}\b/gi, " ")
    .replace(/,?\s*(?:on (?:sera|est)|pour|avec)?\s*\d{1,2}\s*(?:personnes|pers\.?|places|joueurs|amis)\b/gi, " ")
    .replace(/,?\s*il (?:me|nous) manque.*$/i, " ")
    .replace(/\s+([,.!])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[\s,.-]+|[\s,.-]+$/g, "")
    .replace(/\s+(?:à|a|au|le|la|vers|et)$/i, "");
  const base = stripped.length >= 3 ? stripped : clean;
  const first = base.charAt(0).toUpperCase() + base.slice(1);
  const title =
    first.length <= 60
      ? first.replace(/[.!]+$/, "")
      : `${label}${area ? ` à ${area}` : ` à ${city}`}${slot === "evening" ? " ce soir" : ""}`.slice(0, 80);

  return {
    kind,
    title: title.length >= 3 ? title : label,
    description: clean.length >= 10 ? clean : `${label} à ${city}. Viens comme tu es, on fait connaissance sur place.`,
    category: kind === "availability" && category === "other" ? "" : category,
    city,
    area,
    date,
    time,
    slot,
    capacity,
    vibeTags,
    note: kind === "availability" ? clean.slice(0, 200) : "",
    engine: "rules",
  };
}

// ——— Claude ———

const draftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "title", "description", "category", "city", "area", "date", "time", "slot", "capacity", "vibeTags", "note"],
  properties: {
    kind: { type: "string", enum: ["moment", "availability"] },
    title: { type: "string" },
    description: { type: "string" },
    category: { type: "string", enum: categories.map((c) => c.id) },
    city: { type: "string" },
    area: { type: "string" },
    date: { type: ["string", "null"] },
    time: { type: ["string", "null"] },
    slot: { type: ["string", "null"], enum: [...availabilitySlots.map((s) => s.id), null] },
    capacity: { type: ["integer", "null"] },
    vibeTags: { type: "array", items: { type: "string" } },
    note: { type: "string" },
  },
} as const;

const SYSTEM = `Tu es l'assistant de création d'Upclose, une app où l'on propose des Moments réels (un dîner, un verre, un voyage, une soirée) ou où l'on dit qu'on est disponible pour en vivre un.
À partir de la phrase de la personne, remplis un brouillon qu'elle relira avant de publier.
Règles :
- kind = "availability" si la personne dit qu'elle est libre, dispo, ou qu'elle a envie de faire quelque chose sans l'organiser ; sinon "moment".
- title : court (3 à 60 caractères), concret, donne envie, sans emoji ni majuscules partout.
- description : 1 à 3 phrases chaleureuses et concrètes, à la deuxième personne du pluriel ou à la première personne, sans inventer d'adresse, de prix ni de détail non dit.
- category : l'identifiant le plus proche dans la liste. "adult" seulement si la phrase parle explicitement de libertinage, d'échangisme ou d'expérience adulte entre adultes consentants.
- city : une des villes connues si elle est citée, sinon la ville par défaut fournie. area : quartier ou lieu cité, sinon "".
- date au format AAAA-MM-JJ calculée à partir de la date du jour fournie, ou null. time au format HH:MM ou null. slot parmi morning, lunch, afternoon, evening, day, ou null.
- capacity : nombre de places pour les invités (hôte non compris), ou null si non dit.
- vibeTags : 0 à 4 mots d'ambiance en minuscules, choisis de préférence dans la liste fournie.
- note : pour une dispo, une phrase courte qui reprend l'envie (200 caractères max) ; sinon "".
Écris en français.`;

async function parseWithClaude(text: string, ctx: { today: string; weekday: string; city: string; kind: string; adult: boolean }): Promise<Draft | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  try {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: { type: "json_schema", schema: draftJsonSchema as unknown as Record<string, unknown> } },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Date du jour : ${ctx.today} (${ctx.weekday}). Ville par défaut : ${ctx.city}. Villes connues : ${productConfig.cities.join(", ")}.
Catégories : ${categories.map((c) => `${c.id} = ${c.label}`).join(" ; ")}.
Ambiances proposées : ${vibeSuggestions.join(", ")}.
Type demandé : ${ctx.kind === "auto" ? "à déduire" : ctx.kind}.
Phrase de la personne :
"""${text}"""`,
        },
      ],
    });
    if (response.stop_reason === "refusal") return null;
    const block = response.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const d = JSON.parse(block.text) as Omit<Draft, "engine">;
    const category = categories.some((c) => c.id === d.category) ? d.category : "other";
    return {
      kind: ctx.kind === "moment" || ctx.kind === "availability" ? (ctx.kind as Draft["kind"]) : d.kind,
      title: String(d.title ?? "").slice(0, 80),
      description: String(d.description ?? "").slice(0, 2000),
      category: category === ADULT_CATEGORY && !ctx.adult ? "other" : category,
      city: String(d.city || ctx.city).slice(0, 60),
      area: String(d.area ?? "").slice(0, 80),
      date: typeof d.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : null,
      time: typeof d.time === "string" && /^\d{2}:\d{2}$/.test(d.time) ? d.time : null,
      slot: availabilitySlots.some((s) => s.id === d.slot) ? d.slot : null,
      capacity: typeof d.capacity === "number" && d.capacity > 0 ? Math.min(d.capacity, productConfig.limits.maxCapacity) : null,
      vibeTags: Array.isArray(d.vibeTags) ? d.vibeTags.map((x) => String(x).toLowerCase().slice(0, 24)).filter((x) => x.length >= 2).slice(0, 4) : [],
      note: String(d.note ?? "").slice(0, 200),
      engine: "claude",
    };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.warn(`[ai] Claude indisponible (${e.status}) : repli sur les règles`);
    else console.warn("[ai] réponse inexploitable : repli sur les règles");
    return null;
  }
}

/** Transforme une phrase en brouillon de Moment ou de dispo. */
export async function draftFromSentence(viewerIn: Viewer | null, raw: unknown): Promise<Draft> {
  const viewer = requireActive(viewerIn);
  const { text, kind } = inputSchema.parse(raw ?? {});
  const recent = await prisma.auditEvent.count({ where: { actorId: viewer.id, action: "ai.draft", createdAt: { gt: new Date(Date.now() - 3600_000) } } });
  if (recent >= productConfig.limits.aiPerHour) throw new AppError("RATE_LIMITED", "L'assistant a beaucoup servi cette heure-ci. Réessaie un peu plus tard.");
  const month = await prisma.auditEvent.count({ where: { actorId: viewer.id, action: "ai.draft", createdAt: { gt: new Date(Date.now() - 30 * 86400_000) } } });
  if (month >= premiumPlan.freeAiPerMonth) {
    const tier = await currentTier(viewer);
    const cap = tierLimits[tier].aiPer30Days;
    if (month >= cap) {
      throw new AppError(
        tier === "free" ? "PREMIUM_REQUIRED" : "RATE_LIMITED",
        tier === "free"
          ? `L'assistant est offert ${cap} fois sur 30 jours. Upclose+ t'en donne ${tierLimits.plus.aiPer30Days}. Tu peux aussi remplir le formulaire toi-même.`
          : `Tu as utilisé tes ${cap} brouillons de l'assistant sur 30 jours. Remplis le formulaire toi-même en attendant.`,
      );
    }
  }
  await prisma.auditEvent.create({ data: { actorId: viewer.id, action: "ai.draft", targetType: "user", targetId: viewer.id } });

  const tz = productConfig.defaultTimezone;
  const now = new Date();
  const today = utcToZonedLocal(now, tz).slice(0, 10);
  const weekday = new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long" }).format(now);
  const city = viewer.city || productConfig.pilotCity;
  const adult = canSeeAdult(viewer);
  const draft = (await parseWithClaude(text, { today, weekday, city, kind, adult })) ?? parseWithRules(text, { now, tz, defaultCity: city, kind });
  if (draft.category === ADULT_CATEGORY && !adult) draft.category = "other";
  if (draft.date && draft.date < today) draft.date = today;
  return draft;
}

export function aiEngineName(): "claude" | "rules" {
  return process.env.ANTHROPIC_API_KEY ? "claude" : "rules";
}

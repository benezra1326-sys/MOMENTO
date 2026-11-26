/**
 * Traductions de l'interface. Le français est la langue source : chaque texte français sert de clé,
 * et chaque autre langue a un dictionnaire « texte français → traduction ».
 * Un texte absent du dictionnaire s'affiche en français.
 * Pour ajouter une langue : créer son dictionnaire, l'ajouter à `dictionaries` et à `LOCALES`.
 */
import { en, enPatterns } from "./en";

export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "momento_lang";
/** En-tête interne posé par le middleware quand la langue est imposée (adresse dédiée ou ?lang=). */
export const LOCALE_HEADER = "x-momento-locale";

/** Adresse de démo dans une langue : un nom d'hôte qui commence par « momento-en » est toujours en anglais. */
export function localeFromHost(host: string | null): Locale | null {
  const h = (host ?? "").toLowerCase();
  return h.startsWith("momento-en") || h.startsWith("en.") ? "en" : null;
}

type Dict = Record<string, string>;
/** Motifs pour les textes construits côté serveur (messages avec un titre, un nombre…). */
export type Pattern = [RegExp, string];

const dictionaries: Record<Exclude<Locale, "fr">, { dict: Dict; patterns: Pattern[] }> = {
  en: { dict: en, patterns: enPatterns },
};

export function isLocale(v: unknown): v is Locale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}

/** Langue du navigateur (en-tête Accept-Language) : la première langue prise en charge, sinon l'anglais. */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const prefs = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const p of prefs) if (isLocale(p.lang)) return p.lang;
  return DEFAULT_LOCALE;
}

function fill(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

export type T = (s: string, vars?: Record<string, string | number>) => string;

export function makeT(locale: Locale): T {
  if (locale === "fr") return (s, vars) => fill(s, vars);
  const { dict, patterns } = dictionaries[locale];
  return (s, vars) => {
    const hit = dict[s];
    if (hit !== undefined) return fill(hit, vars);
    for (const [re, out] of patterns) {
      if (re.test(s)) return fill(s.replace(re, out), vars);
    }
    return fill(s, vars);
  };
}

/** Code de langue pour Intl (dates, nombres). */
export function intlLocale(locale: Locale) {
  return locale === "fr" ? "fr-FR" : "en-GB";
}

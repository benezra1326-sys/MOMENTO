import { intlLocale, type Locale } from "./i18n/core";

/**
 * Utilitaires de date avec fuseau horaire, sans dépendance externe.
 * Les dates sont stockées en UTC ; chaque Moment garde son fuseau (IANA).
 */

function partsInZone(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Décalage (ms) entre l'heure locale du fuseau et UTC à un instant donné. */
function zoneOffset(date: Date, timeZone: string): number {
  const p = partsInZone(date, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** « 2026-11-28T19:00 » interprété dans `timeZone` → instant UTC. */
export function zonedLocalToUtc(local: string, timeZone: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return new Date(NaN);
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let ts = guess - zoneOffset(new Date(guess), timeZone);
  // Deuxième passe pour les changements d'heure.
  ts = guess - zoneOffset(new Date(ts), timeZone);
  return new Date(ts);
}

/** Instant UTC → « 2026-11-28T19:00 » dans le fuseau (pour les champs de formulaire). */
export function utcToZonedLocal(date: Date, timeZone: string): string {
  const p = partsInZone(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function formatMomentDate(date: Date | string, timeZone: string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

export function formatMomentTime(date: Date | string, timeZone: string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone, hour: "2-digit", minute: "2-digit" }).format(d);
}

export function formatLongDate(date: Date | string, timeZone: string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function formatRelative(date: Date | string, locale: Locale = "fr"): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return locale === "fr" ? "à l'instant" : "just now";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

/** Durée par défaut d'un Moment sans heure de fin, pour savoir s'il est terminé. */
export const DEFAULT_DURATION_MS = 3 * 3600 * 1000;

export function momentEnd(startsAt: Date, endsAt: Date | null): Date {
  return endsAt ?? new Date(startsAt.getTime() + DEFAULT_DURATION_MS);
}

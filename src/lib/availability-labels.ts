import { availabilitySlots } from "@/config/product";
import type { Locale } from "./i18n/core";
import { formatMomentDate, formatMomentTime, utcToZonedLocal } from "./time";

type T = (s: string, v?: Record<string, string | number>) => string;

/** « Aujourd'hui », « Demain » ou « sam. 28 nov. », dans le fuseau du lieu. */
export function dayLabel(iso: string, tz: string, locale: Locale, t: T, now = new Date()): string {
  const day = utcToZonedLocal(new Date(iso), tz).slice(0, 10);
  const today = utcToZonedLocal(now, tz).slice(0, 10);
  const tomorrow = utcToZonedLocal(new Date(now.getTime() + 86400_000), tz).slice(0, 10);
  if (day === today) return t("Aujourd'hui");
  if (day === tomorrow) return t("Demain");
  const s = formatMomentDate(iso, tz, locale);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function slotLabel(slot: string, t: T): string {
  return t(availabilitySlots.find((s) => s.id === slot)?.label ?? "Toute la journée");
}

/** « 18:00 – 21:00 » : plage horaire locale d'une disponibilité. */
export function hourRange(a: { startsAt: string; endsAt: string; timezone: string }, locale: Locale): string {
  return `${formatMomentTime(a.startsAt, a.timezone, locale)} – ${formatMomentTime(a.endsAt, a.timezone, locale)}`;
}

/** « Demain · 18:00 – 21:00 » : jour et plage horaire d'une disponibilité. */
export function availabilityWhen(a: { startsAt: string; endsAt: string; timezone: string }, locale: Locale, t: T): string {
  return `${dayLabel(a.startsAt, a.timezone, locale, t)} · ${hourRange(a, locale)}`;
}

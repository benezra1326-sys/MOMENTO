"use client";

import { CalendarHeart } from "lucide-react";
import { categoryLabel } from "@/config/product";
import { availabilityWhen } from "@/lib/availability-labels";
import type { DispoSnapshot } from "@/server/availability";
import { useLocale, useT } from "./I18nProvider";

/** Rappel de la dispo à l'origine d'une invitation : le message, l'horaire, le lieu et les envies. */
export function DispoQuote({ dispo, title, className = "" }: { dispo: DispoSnapshot; title: string; className?: string }) {
  const t = useT();
  const locale = useLocale();
  const where = [dispo.area, dispo.city].filter(Boolean).join(", ");
  const envies = dispo.categories.map((c) => t(categoryLabel(c))).join(", ");
  return (
    <div className={`rounded-2xl border-l-4 border-accent bg-surface-2/60 px-3.5 py-2.5 ${className}`}>
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent">
        <CalendarHeart size={13} aria-hidden /> {title}
      </p>
      {dispo.note && <p className="mt-1 font-medium text-ink">« {t(dispo.note)} »</p>}
      <p className="mt-0.5 text-sm text-ink-2">
        {availabilityWhen(dispo, locale, t)}
        {where && ` · ${where}`}
      </p>
      {envies && <p className="text-sm text-muted">{t("Envie de : {x}", { x: envies })}</p>}
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { categories, productConfig } from "@/config/product";
import { useT } from "./I18nProvider";

export const whenOptions = [
  { id: "today", label: "Aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Week-end" },
  { id: "later", label: "Plus tard" },
];

/**
 * Filtres réduits au strict nécessaire : la ville, puis une seule rangée « quand ».
 * Les catégories sont rangées derrière « Filtres ». Pas de menu de tri : le feed est
 * toujours classé pour la personne (bientôt, près d'elle, hôtes bien notés).
 */
export function FeedFilters({ showCategories = true, showAdult = false }: { showCategories?: boolean; showAdult?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const t = useT();
  const category = params.get("category") ?? "";
  const [open, setOpen] = useState(!!category);

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    next.delete("sort");
    start(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  }

  const city = params.get("city") ?? "";
  const when = params.get("when") ?? "";

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="flex items-center gap-2">
        <label className="relative inline-flex min-w-0 flex-1 items-center sm:flex-none">
          <span className="sr-only">{t("Ville")}</span>
          <MapPin size={16} className="pointer-events-none absolute left-3 text-muted" aria-hidden />
          <select
            value={city}
            onChange={(e) => set("city", e.target.value)}
            className="min-h-10 w-full appearance-none rounded-full border border-border bg-surface py-2 pl-9 pr-8 text-sm font-semibold"
          >
            <option value="">{t("Toutes les villes")}</option>
            {productConfig.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-xs text-muted" aria-hidden>▾</span>
        </label>
        {showCategories && (
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
            className={`chip shrink-0 ${category ? "chip-active" : ""}`}
          >
            <SlidersHorizontal size={15} aria-hidden /> {t("Filtres")}{category ? " · 1" : ""}
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2" role="group" aria-label={t("Quand")}>
        {whenOptions.map((o) => (
          <button key={o.id} type="button" aria-pressed={when === o.id} onClick={() => set("when", when === o.id ? "" : o.id)} className={`chip justify-center px-2 text-[13px] sm:px-3.5 sm:text-sm ${when === o.id ? "chip-active" : ""}`}>
            {t(o.label)}
          </button>
        ))}
      </div>
      {showCategories && open && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Catégorie")}>
          <button type="button" aria-pressed={!category} onClick={() => set("category", "")} className={`chip ${!category ? "chip-active" : ""}`}>
            {t("Toutes")}
          </button>
          {categories.filter((c) => showAdult || c.id !== "adult").map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => set("category", c.id)} className={`chip ${category === c.id ? "chip-active" : ""}`}>
              {t(c.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

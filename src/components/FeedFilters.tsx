"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { MapPin } from "lucide-react";
import { categories, productConfig } from "@/config/product";
import { useT } from "./I18nProvider";

const whenOptions = [
  { id: "", label: "À venir" },
  { id: "today", label: "Aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Ce week-end" },
  { id: "week", label: "7 jours" },
];

export function FeedFilters({ showCategories = true }: { showCategories?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const t = useT();

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("cursor");
    start(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  }

  const city = params.get("city") ?? "";
  const when = params.get("when") ?? "";
  const category = params.get("category") ?? "";
  const sort = params.get("sort") ?? "date";

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative inline-flex items-center">
          <span className="sr-only">{t("Ville")}</span>
          <MapPin size={16} className="pointer-events-none absolute left-3 text-muted" aria-hidden />
          <select
            value={city}
            onChange={(e) => set("city", e.target.value)}
            className="min-h-10 appearance-none rounded-full border border-border bg-surface py-2 pl-9 pr-8 text-sm font-semibold"
          >
            <option value="">{t("Toutes les villes")}</option>
            {productConfig.cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 text-xs text-muted" aria-hidden>▾</span>
        </label>
        <div className="ml-auto inline-flex rounded-full border border-border bg-surface p-1 text-sm" role="group" aria-label={t("Trier")}>
          {[
            { id: "date", label: "Par date" },
            { id: "recent", label: "Nouveautés" },
          ].map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={sort === o.id}
              onClick={() => set("sort", o.id === "date" ? "" : o.id)}
              className={`rounded-full px-3 py-1.5 font-medium ${sort === o.id ? "bg-ink text-night" : "text-muted hover:text-ink"}`}
            >
              {t(o.label)}
            </button>
          ))}
        </div>
      </div>
      <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("Quand")}>
        {whenOptions.map((o) => (
          <button key={o.id} type="button" aria-pressed={when === o.id} onClick={() => set("when", o.id)} className={`chip ${when === o.id ? "chip-active" : ""}`}>
            {t(o.label)}
          </button>
        ))}
      </div>
      {showCategories && (
        <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("Catégorie")}>
          <button type="button" aria-pressed={!category} onClick={() => set("category", "")} className={`chip ${!category ? "chip-active" : ""}`}>
            {t("Tout")}
          </button>
          {categories.map((c) => (
            <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => set("category", c.id)} className={`chip ${category === c.id ? "chip-active" : ""}`}>
              {t(c.label)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { LocateFixed, Loader2, MapPin, SlidersHorizontal, X } from "lucide-react";
import { distanceOptions } from "@/lib/geo";
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
const slotOptions = [
  { id: "morning", label: "Matin" },
  { id: "lunch", label: "Midi" },
  { id: "afternoon", label: "Après-midi" },
  { id: "evening", label: "Soir" },
];

export function FeedFilters({ showCategories = true, showAdult = false, showSlots = false }: { showCategories?: boolean; showAdult?: boolean; showSlots?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const t = useT();
  const category = params.get("category") ?? "";
  const [open, setOpen] = useState(!!category);

  function setMany(values: Record<string, string>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("cursor");
    next.delete("sort");
    start(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  }
  const set = (key: string, value: string) => setMany({ [key]: value });

  const city = params.get("city") ?? "";
  const when = params.get("when") ?? "";
  const near = params.get("near") ?? "";
  const km = Number(params.get("km")) || 5;
  const slot = params.get("creneau") ?? "";
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  function aroundMe(radius = km) {
    if (!("geolocation" in navigator)) return setGeoError(t("Ton appareil ne donne pas sa position."));
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false);
        // Arrondie à ~100 m : la position exacte ne quitte jamais le téléphone.
        const pos = `${p.coords.latitude.toFixed(3)},${p.coords.longitude.toFixed(3)}`;
        setMany({ near: pos, km: String(radius), city: "" });
      },
      () => {
        setLocating(false);
        setGeoError(t("Autorise la localisation pour voir ce qui se passe autour de toi."));
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }

  return (
    <div className={`space-y-3 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <div className="flex items-center gap-2">
        <label className="relative inline-flex min-w-0 flex-1 items-center sm:flex-none">
          <span className="sr-only">{t("Ville")}</span>
          <MapPin size={16} className="pointer-events-none absolute left-3 text-muted" aria-hidden />
          <select
            value={city}
            onChange={(e) => setMany({ city: e.target.value, ...(e.target.value ? { near: "", km: "" } : {}) })}
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
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2" role="group" aria-label={t("Autour de moi")}>
        {near ? (
          <>
            <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent"><LocateFixed size={15} aria-hidden /> {t("Autour de moi")}</span>
            {distanceOptions.map((d) => (
              <button key={d} type="button" aria-pressed={km === d} onClick={() => set("km", String(d))} className={`chip px-3 text-[13px] sm:text-sm ${km === d ? "chip-active" : ""}`}>
                {`${d} km`}
              </button>
            ))}
            <button type="button" onClick={() => setMany({ near: "", km: "" })} className="chip px-2.5" aria-label={t("Retirer le filtre de distance")}>
              <X size={15} aria-hidden />
            </button>
          </>
        ) : (
          <button type="button" onClick={() => aroundMe(5)} disabled={locating} className="chip">
            {locating ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <LocateFixed size={15} aria-hidden />} {t("Autour de moi")}
          </button>
        )}
        {geoError && <p role="alert" className="w-full text-sm text-danger">{geoError}</p>}
      </div>
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2" role="group" aria-label={t("Quand")}>
        {whenOptions.map((o) => (
          <button key={o.id} type="button" aria-pressed={when === o.id} onClick={() => set("when", when === o.id ? "" : o.id)} className={`chip justify-center px-2 text-[13px] sm:px-3.5 sm:text-sm ${when === o.id ? "chip-active" : ""}`}>
            {t(o.label)}
          </button>
        ))}
      </div>
      {showSlots && (
        <div className="grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap sm:gap-2" role="group" aria-label={t("Créneau")}>
          {slotOptions.map((o) => (
            <button key={o.id} type="button" aria-pressed={slot === o.id} onClick={() => set("creneau", slot === o.id ? "" : o.id)} className={`chip justify-center px-2 text-[13px] sm:px-3.5 sm:text-sm ${slot === o.id ? "chip-active" : ""}`}>
              {t(o.label)}
            </button>
          ))}
        </div>
      )}
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

"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "./I18nProvider";

/**
 * Deux univers dans le feed : Invitations (les Moments) et Disponibilités (les gens libres).
 * Un vrai glissement horizontal : on balaie du doigt ou on touche l'onglet, l'indicateur suit.
 */
export function UniverseSwitch({ labels, initial = 0, children }: { labels: [string, string]; initial?: 0 | 1; children: [React.ReactNode, React.ReactNode] }) {
  const t = useT();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState<0 | 1>(initial);
  const [progress, setProgress] = useState<number>(initial);

  useEffect(() => {
    const el = track.current;
    if (el && initial === 1) el.scrollTo({ left: el.clientWidth, behavior: "instant" as ScrollBehavior });
  }, [initial]);

  function go(i: 0 | 1) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
    setIndex(i);
    const url = new URL(window.location.href);
    if (i === 1) url.searchParams.set("univers", "dispos");
    else url.searchParams.delete("univers");
    window.history.replaceState(null, "", url);
  }

  function onScroll() {
    const el = track.current;
    if (!el || !el.clientWidth) return;
    const p = el.scrollLeft / el.clientWidth;
    setProgress(p);
    const i = (p > 0.5 ? 1 : 0) as 0 | 1;
    if (i !== index) {
      setIndex(i);
      const url = new URL(window.location.href);
      if (i === 1) url.searchParams.set("univers", "dispos");
      else url.searchParams.delete("univers");
      window.history.replaceState(null, "", url);
    }
  }

  return (
    <div>
      <div role="tablist" aria-label={t("Univers")} className="sticky top-16 z-20 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur-md sm:mx-0 sm:px-0">
        <div className="relative grid grid-cols-2 rounded-full border border-border bg-surface p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-signature shadow-lg shadow-primary/20"
            style={{ transform: `translateX(${Math.min(1, Math.max(0, progress)) * 100}%)` }}
          />
          {labels.map((l, i) => (
            <button
              key={l}
              type="button"
              role="tab"
              aria-selected={index === i}
              onClick={() => go(i as 0 | 1)}
              className={`relative z-10 min-h-10 rounded-full text-sm font-semibold transition-colors ${index === i ? "text-white" : "text-muted"}`}
            >
              {t(l)}
            </button>
          ))}
        </div>
      </div>
      <div
        ref={track}
        onScroll={onScroll}
        className="-mx-4 mt-4 flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:mx-0 [&::-webkit-scrollbar]:hidden"
      >
        {children.map((c, i) => (
          <section
            key={i}
            role="tabpanel"
            aria-hidden={index !== i}
            className={`w-full min-w-0 shrink-0 snap-start px-4 sm:px-0 ${index !== i ? "max-h-[80vh] overflow-hidden" : ""}`}
          >
            {c}
          </section>
        ))}
      </div>
    </div>
  );
}

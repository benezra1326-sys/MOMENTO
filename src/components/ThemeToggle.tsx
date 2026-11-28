"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Palette } from "lucide-react";

const COOKIE = "upclose_theme";

/** Choix du thème pour les membres Black : classique ou noir et or (avec l'icône Black). */
export function ThemeToggle({ black }: { black: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(black);
  function choose(v: boolean) {
    setOn(v);
    document.cookie = `${COOKIE}=${v ? "black" : "classic"}; path=/; max-age=${3600 * 24 * 400}; samesite=lax`;
    document.documentElement.dataset.theme = v ? "black" : "";
    if (!v) delete document.documentElement.dataset.theme;
    router.refresh();
  }
  return (
    <div className="rounded-2xl border border-[#d4af6a]/40 bg-black/40 p-4">
      <p className="flex items-center gap-2 font-semibold"><Palette size={16} aria-hidden /> Thème de l&apos;app</p>
      <p className="mt-1 text-sm text-muted">Réservé aux membres Black. L&apos;icône de l&apos;app passe aussi en noir et or (réinstalle l&apos;app sur ton écran d&apos;accueil pour la voir).</p>
      <div role="radiogroup" aria-label="Thème" className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" role="radio" aria-checked={!on} onClick={() => choose(false)} className={`rounded-2xl border p-3 text-left text-sm ${!on ? "border-ink" : "border-border"}`}>
          <span className="mb-2 block h-8 rounded-lg" style={{ background: "linear-gradient(135deg,#1d1626,#342a47)" }} />
          Classique
        </button>
        <button type="button" role="radio" aria-checked={on} onClick={() => choose(true)} className={`rounded-2xl border p-3 text-left text-sm ${on ? "border-[#d4af6a]" : "border-border"}`}>
          <span className="mb-2 flex h-8 items-center justify-center rounded-lg bg-black text-[#d4af6a]"><Crown size={16} aria-hidden /></span>
          Noir et or
        </button>
      </div>
    </div>
  );
}

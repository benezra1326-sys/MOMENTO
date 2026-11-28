"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Crown, Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { plans, priceLabel, type Interval, type PlanId, type Tier } from "@/lib/premium";

const pitch: Record<PlanId, string[]> = {
  plus: ["Moments et assistant illimités", "1 boost « Mis en avant » par mois", "Badge Upclose+"],
  black: ["Tout Upclose+", "4 boosts par mois", "Qui a vu tes Moments et ton profil", "Personnes pour toi", "Moments réservés Black", "Badge Black"],
};

/** Choix de l'offre (mensuel ou annuel) et achat ; résiliation si déjà membre. */
export function PremiumPlans({ tier, cancelAt, source, returnTo }: { tier: Tier; cancelAt: string | null; source: string | null; returnTo?: string | null }) {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("month");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(plan: PlanId) {
    setBusy(plan);
    setError(null);
    const res = await api<{ url: string }>("/api/billing/checkout", { body: { plan, interval, ...(returnTo ? { returnTo } : {}) } });
    if (!res.ok) {
      setBusy(null);
      setError(res.error.message);
      return;
    }
    if (res.data.url.startsWith("/")) router.push(res.data.url);
    else window.location.href = res.data.url;
  }

  async function cancel() {
    const msg = source === "stripe" ? "Résilier ? Tu gardes ton offre jusqu'à la fin de la période payée." : "Revenir à l'offre gratuite maintenant ?";
    if (!window.confirm(msg)) return;
    setBusy("cancel");
    setError(null);
    const res = await api("/api/billing/cancel", { body: {} });
    setBusy(null);
    if (!res.ok) setError(res.error.message);
    else router.refresh();
  }

  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Période" className="inline-flex rounded-full bg-surface-2/70 p-1 text-sm">
        {(["month", "year"] as const).map((i) => (
          <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={`rounded-full px-4 py-1.5 font-medium ${interval === i ? "bg-surface text-ink shadow" : "text-muted"}`}>
            {i === "month" ? "Mensuel" : "Annuel · −30 %"}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["plus", "black"] as const).map((id) => {
          const p = plans[id];
          const current = tier === id;
          const cents = p[interval];
          return (
            <div key={id} className={`flex flex-col gap-3 rounded-3xl border p-5 ${id === "black" ? "border-ink/30 bg-night text-white" : "border-border/70 bg-surface-2/40"}`}>
              <p className="flex items-center gap-2 font-semibold">{id === "black" ? <Crown size={16} /> : <Sparkles size={16} />} {p.name}</p>
              <p>
                <span className="font-display text-3xl">{priceLabel(cents)}</span>
                <span className={id === "black" ? "text-white/70" : "text-muted"}> / {interval === "month" ? "mois" : "an"}</span>
              </p>
              {interval === "year" && <p className={`text-xs ${id === "black" ? "text-white/70" : "text-muted"}`}>Soit {priceLabel(Math.round(cents / 12))} par mois</p>}
              <ul className={`space-y-1 text-sm ${id === "black" ? "text-white/85" : "text-ink-2"}`}>
                {pitch[id].map((x) => <li key={x}>· {x}</li>)}
              </ul>
              <div className="mt-auto pt-1">
                {current ? (
                  cancelAt ? (
                    <p className="text-sm opacity-80">Résilié, actif jusqu&apos;au {new Date(cancelAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.</p>
                  ) : (
                    <button type="button" onClick={cancel} disabled={!!busy} className="btn-secondary w-full">
                      {busy === "cancel" && <Loader2 size={16} className="animate-spin" />} {source === "stripe" ? "Résilier" : "Revenir au gratuit"}
                    </button>
                  )
                ) : (
                  <button type="button" onClick={() => subscribe(id)} disabled={!!busy} className={id === "black" ? "btn-secondary w-full !bg-white !text-night" : "btn-primary w-full"}>
                    {busy === id && <Loader2 size={16} className="animate-spin" />} {tier === "free" ? `Choisir ${p.name}` : `Passer à ${p.name}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

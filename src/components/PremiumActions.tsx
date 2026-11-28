"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Crown, Loader2, Minus, Sparkles, User } from "lucide-react";
import { api } from "@/lib/client";
import { comingSoon, planFeatures, planPerks, plans, priceLabel, type Interval, type PlanId, type Tier } from "@/lib/premium";

const tierName: Record<Tier, string> = { free: "Gratuit", plus: "Upclose+", black: "Black" };
const gold = "text-[#e2c486]";

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={18} className="mx-auto text-success" aria-label="Inclus" />;
  if (v === false) return <Minus size={18} className="mx-auto text-muted" aria-label="Non inclus" />;
  return <span>{v}</span>;
}

/**
 * Les trois offres côte à côte : on touche une offre pour voir ses avantages par rapport aux autres,
 * puis on s'abonne, on change d'offre ou on revient au gratuit.
 */
export function PremiumPlans({
  tier,
  cancelAt,
  source,
  returnTo,
  canBuy,
}: {
  tier: Tier;
  cancelAt: string | null;
  source: string | null;
  returnTo?: string | null;
  canBuy: boolean;
}) {
  const router = useRouter();
  const [interval, setInterval] = useState<Interval>("month");
  const [selected, setSelected] = useState<Tier>(tier === "free" ? "black" : tier);
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

  const isBlack = selected === "black";
  const perks = planPerks[selected];
  const price = selected === "free" ? null : plans[selected][interval];

  let cta: React.ReactNode = null;
  if (selected === tier) {
    cta =
      tier === "free" ? (
        <p className="text-sm text-muted">C&apos;est ton offre actuelle.</p>
      ) : cancelAt ? (
        <p className="text-sm opacity-80">Résilié, actif jusqu&apos;au {new Date(cancelAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.</p>
      ) : (
        <div className="space-y-2">
          <p className={`flex items-center gap-2 text-sm font-semibold ${isBlack ? gold : "text-success"}`}><Check size={16} aria-hidden /> C&apos;est ton offre actuelle</p>
          <button type="button" onClick={cancel} disabled={!!busy} className="btn-secondary w-full">
            {busy === "cancel" && <Loader2 size={16} className="animate-spin" />} {source === "stripe" ? "Résilier" : "Revenir au gratuit"}
          </button>
        </div>
      );
  } else if (selected === "free") {
    cta = cancelAt ? null : (
      <button type="button" onClick={cancel} disabled={!!busy} className="btn-secondary w-full">
        {busy === "cancel" && <Loader2 size={16} className="animate-spin" />} {source === "stripe" ? "Résilier mon abonnement" : "Revenir au gratuit"}
      </button>
    );
  } else if (canBuy) {
    const p = plans[selected];
    cta = (
      <button
        type="button"
        onClick={() => subscribe(selected)}
        disabled={!!busy}
        className={`inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 font-semibold transition ${isBlack ? "bg-gradient-to-r from-[#f3dfa2] via-[#d4af6a] to-[#9c7a3c] text-black hover:brightness-105" : "bg-primary text-white hover:bg-primary-hover"}`}
      >
        {busy === selected ? <Loader2 size={16} className="animate-spin" /> : isBlack ? <Crown size={16} aria-hidden /> : <Sparkles size={16} aria-hidden />}
        {tier === "free" ? `Devenir ${p.name}` : `Passer à ${p.name}`}
      </button>
    );
  }

  return (
    <div className="space-y-5">
      {/* Choix de l'offre */}
      <div role="tablist" aria-label="Offres" className="grid grid-cols-3 gap-2">
        {(["free", "plus", "black"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected === id}
            onClick={() => setSelected(id)}
            className={`relative flex flex-col items-center gap-0.5 rounded-2xl border px-2 py-3 text-sm font-semibold transition ${
              selected === id
                ? id === "black"
                  ? "border-[#d4af6a] bg-black text-[#e2c486] shadow-[0_0_24px_-8px_#d4af6a]"
                  : "border-ink bg-ink text-night"
                : id === "black"
                  ? "border-[#d4af6a]/40 bg-black/60 text-[#e2c486]"
                  : "border-border bg-surface-2/50 text-ink-2"
            }`}
          >
            {id === "black" ? <Crown size={18} aria-hidden /> : id === "plus" ? <Sparkles size={18} aria-hidden /> : <User size={18} aria-hidden />}
            {tierName[id]}
            <span className="text-[11px] font-normal opacity-80">{id === "free" ? "0 €" : `${priceLabel(plans[id].month)}/mois`}</span>
            {tier === id && <span className="absolute -top-2 rounded-full bg-success px-2 text-[10px] font-bold text-night">ACTUELLE</span>}
          </button>
        ))}
      </div>

      {/* Détail de l'offre choisie */}
      <div
        className={`space-y-4 rounded-3xl border p-5 sm:p-6 ${
          isBlack ? "border-[#d4af6a]/60 bg-[radial-gradient(120%_80%_at_100%_0%,#3a2f17_0%,#000_55%)] text-white" : "border-border/70 bg-surface-2/40"
        }`}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className={`flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] ${isBlack ? gold : "text-accent"}`}>
              {isBlack ? <Crown size={15} aria-hidden /> : selected === "plus" ? <Sparkles size={15} aria-hidden /> : <User size={15} aria-hidden />}
              {selected === "free" ? "Gratuit" : plans[selected].name}
            </p>
            <p className="mt-1">
              <span className={`font-display text-4xl ${isBlack ? gold : ""}`}>{price === null ? "0 €" : priceLabel(price)}</span>
              {price !== null && <span className={isBlack ? "text-white/70" : "text-muted"}> / {interval === "month" ? "mois" : "an"}</span>}
            </p>
            {price !== null && interval === "year" && <p className={`text-xs ${isBlack ? "text-white/70" : "text-muted"}`}>Soit {priceLabel(Math.round(price / 12))} par mois</p>}
          </div>
          {selected !== "free" && (
            <div role="radiogroup" aria-label="Période" className={`inline-flex rounded-full p-1 text-sm ${isBlack ? "bg-white/10" : "bg-surface-2/70"}`}>
              {(["month", "year"] as const).map((i) => (
                <button key={i} type="button" role="radio" aria-checked={interval === i} onClick={() => setInterval(i)} className={`rounded-full px-3.5 py-1.5 font-medium ${interval === i ? (isBlack ? "bg-[#d4af6a] text-black" : "bg-surface text-ink shadow") : isBlack ? "text-white/70" : "text-muted"}`}>
                  {i === "month" ? "Mensuel" : "Annuel −30 %"}
                </button>
              ))}
            </div>
          )}
        </div>

        <p className={`text-sm ${isBlack ? "text-white/80" : "text-ink-2"}`}>
          {selected === "free" ? "Ce qui reste gratuit pour tout le monde :" : selected === "plus" ? "En plus de l'offre gratuite :" : "Le meilleur d'Upclose, en plus d'Upclose+ :"}
        </p>
        <ul className="space-y-3">
          {perks.map((p) => (
            <li key={p.title} className="flex gap-3">
              <span className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isBlack ? "bg-[#d4af6a] text-black" : selected === "plus" ? "bg-primary text-white" : "bg-surface text-ink-2"}`}>
                <Check size={14} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">{p.title}</span>
                <span className={`block text-sm ${isBlack ? "text-white/70" : "text-muted"}`}>{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
        {selected !== "free" && (
          <div className={`rounded-2xl border border-dashed px-4 py-3 text-sm ${isBlack ? "border-[#d4af6a]/40 text-white/70" : "border-border text-muted"}`}>
            <p className="font-semibold">Bientôt{isBlack ? " pour les organisateurs réguliers" : ""}</p>
            <p>{comingSoon[selected].join(", ")}. En préparation, pas encore inclus.</p>
          </div>
        )}
        {cta && <div className="pt-1">{cta}</div>}
        {selected !== "free" && selected !== tier && canBuy && price !== null && (
          <p className={`text-xs ${isBlack ? "text-white/60" : "text-muted"}`}>
            {priceLabel(price)} par {interval === "month" ? "mois" : "an"}, renouvelé automatiquement jusqu&apos;à résiliation. Sans engagement : tu résilies quand tu veux, tes Moments et discussions restent accessibles.
          </p>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>

      {/* Comparaison complète, colonne de l'offre choisie mise en avant */}
      <div className="overflow-x-auto rounded-3xl border border-border/70">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              <th className="py-3 pl-4 pr-2 font-medium text-muted sm:p-4">Comparer les offres</th>
              {(["free", "plus", "black"] as const).map((id) => (
                <th key={id} className={`w-[4.5rem] px-1 py-3 text-center font-semibold sm:w-24 sm:p-4 ${selected === id ? (id === "black" ? "bg-black text-[#e2c486]" : "bg-surface-2") : ""}`}>
                  <button type="button" onClick={() => setSelected(id)} className="underline-offset-2 hover:underline">{tierName[id]}</button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {planFeatures.map((f) => (
              <tr key={f.label} className="border-b border-border/40 last:border-0">
                <td className="py-3 pl-4 pr-2 text-ink-2 sm:p-4">{f.label}</td>
                {(["free", "plus", "black"] as const).map((id) => (
                  <td key={id} className={`px-1 py-3 text-center sm:p-4 ${selected === id ? (id === "black" ? "bg-black text-[#e2c486]" : "bg-surface-2") : id === "free" ? "text-muted" : ""}`}>
                    <Cell v={f[id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

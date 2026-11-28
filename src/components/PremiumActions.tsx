"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { premiumPlan } from "@/lib/premium";

/** Bouton « Passer à Upclose+ » (ou résiliation si déjà membre). */
export function PremiumActions({ premium, cancelAt, source }: { premium: boolean; cancelAt: string | null; source: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setBusy(true);
    setError(null);
    const res = await api<{ url: string }>("/api/billing/checkout", { body: {} });
    if (!res.ok) {
      setBusy(false);
      setError(res.error.message);
      return;
    }
    if (res.data.url.startsWith("/")) router.push(res.data.url);
    else window.location.href = res.data.url;
  }

  async function cancel() {
    const msg = source === "stripe" ? "Résilier ? Tu gardes Upclose+ jusqu'à la fin du mois payé." : "Revenir à l'offre gratuite maintenant ?";
    if (!window.confirm(msg)) return;
    setBusy(true);
    setError(null);
    const res = await api("/api/billing/cancel", { body: {} });
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    else router.refresh();
  }

  if (premium) {
    return (
      <div className="space-y-2">
        {cancelAt ? (
          <p className="text-sm text-muted">Résilié : Upclose+ reste actif jusqu&apos;au {new Date(cancelAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}.</p>
        ) : (
          <button type="button" onClick={cancel} disabled={busy} className="btn-secondary">
            {busy && <Loader2 size={16} className="animate-spin" />} {source === "stripe" ? "Résilier l'abonnement" : "Revenir à l'offre gratuite"}
          </button>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <button type="button" onClick={subscribe} disabled={busy} className="btn-primary w-full sm:w-auto">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Passer à Upclose+ · {premiumPlan.priceLabel}/{premiumPlan.period}
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}

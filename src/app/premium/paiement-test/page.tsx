"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CreditCard, Loader2, Lock } from "lucide-react";
import { api } from "@/lib/client";
import { premiumPlan } from "@/lib/premium";

/** Paiement simulé (quand Stripe n'est pas encore branché) : même parcours, aucun débit. */
export default function TestPaymentPage() {
  const router = useRouter();
  const [card, setCard] = useState("4242 4242 4242 4242");
  const [exp, setExp] = useState("12/30");
  const [cvc, setCvc] = useState("123");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api("/api/billing/simulate", { body: { card } });
    setBusy(false);
    if (!res.ok) setError(res.error.message);
    else router.push("/premium/merci?test=1");
  }

  return (
    <form onSubmit={pay} className="card mx-auto max-w-md space-y-4 p-6">
      <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">Paiement de test : aucune carte n&apos;est débitée.</p>
      <div>
        <h1 className="font-display text-2xl">{premiumPlan.name}</h1>
        <p className="text-ink-2">{premiumPlan.priceLabel} par {premiumPlan.period}, sans engagement</p>
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm text-muted">Numéro de carte</span>
        <span className="flex items-center gap-2 rounded-2xl border border-border bg-surface-2/60 px-3">
          <CreditCard size={18} className="text-muted" />
          <input inputMode="numeric" value={card} onChange={(e) => setCard(e.target.value)} className="w-full bg-transparent py-3 font-mono outline-none" />
        </span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">Expiration</span>
          <input value={exp} onChange={(e) => setExp(e.target.value)} className="w-full rounded-2xl border border-border bg-surface-2/60 px-3 py-3 font-mono outline-none" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm text-muted">CVC</span>
          <input value={cvc} onChange={(e) => setCvc(e.target.value)} className="w-full rounded-2xl border border-border bg-surface-2/60 px-3 py-3 font-mono outline-none" />
        </label>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />} Payer {premiumPlan.priceLabel}
      </button>
      <p className="text-xs text-muted">Pour tester un refus : 4000 0000 0000 0002.</p>
      <p className="text-center"><Link href="/premium" className="text-sm text-muted underline-offset-2 hover:underline">Annuler</Link></p>
    </form>
  );
}

"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { api } from "@/lib/client";
import { premiumPlan } from "@/lib/premium";

/** Recette : paiement simulé (BILLING_MODE=simulated), aucun débit. */
function Simulator() {
  const router = useRouter();
  const retour = useSearchParams().get("retour");
  const [busy, setBusy] = useState<"success" | "failure" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(outcome: "success" | "failure") {
    setBusy(outcome);
    setError(null);
    const res = await api("/api/billing/simulate", { body: { outcome } });
    setBusy(null);
    if (!res.ok) setError(res.error.message);
    else router.push(`/premium/merci?test=1${retour ? `&retour=${encodeURIComponent(retour)}` : ""}`);
  }

  return (
    <section className="card mx-auto max-w-md space-y-4 p-6">
      <p className="rounded-2xl bg-warn-soft px-4 py-3 text-sm text-warn">Paiement simulé : aucune carte, aucun débit.</p>
      <div>
        <h1 className="font-display text-2xl">{premiumPlan.name}</h1>
        <p className="text-ink-2">{premiumPlan.priceLabel} par {premiumPlan.period}, sans engagement</p>
      </div>
      {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      <div className="grid gap-2 sm:grid-cols-2">
        <button type="button" disabled={!!busy} onClick={() => run("success")} className="btn-primary">
          {busy === "success" ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} Simuler un succès
        </button>
        <button type="button" disabled={!!busy} onClick={() => run("failure")} className="btn-secondary">
          {busy === "failure" ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />} Simuler un refus
        </button>
      </div>
      <p className="text-center">
        <Link href={`/premium${retour ? `?retour=${encodeURIComponent(retour)}` : ""}`} className="text-sm text-muted underline-offset-2 hover:underline">Annuler</Link>
      </p>
    </section>
  );
}

export default function TestPaymentPage() {
  return (
    <Suspense>
      <Simulator />
    </Suspense>
  );
}

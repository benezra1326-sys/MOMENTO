"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/client";

function Confirm() {
  const params = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const simulated = params.get("test") === "1";
  const raw = params.get("retour");
  const retour = raw && /^\/(?!\/)[A-Za-z0-9\-_/]*$/.test(raw) ? raw : null;
  const [state, setState] = useState<"loading" | "ok" | "pending" | "error">(simulated ? "ok" : "loading");
  const [error, setError] = useState("");
  useEffect(() => {
    if (simulated) return;
    let live = true;
    api<{ premium: boolean }>("/api/billing/confirm", { body: { sessionId } }).then((res) => {
      if (!live) return;
      if (!res.ok) {
        setState("error");
        setError(res.error.message);
      } else setState(res.data.premium ? "ok" : "pending");
    });
    return () => {
      live = false;
    };
  }, [sessionId, simulated]);
  return (
    <section className="card mx-auto max-w-md space-y-4 p-6 text-center">
      {state === "loading" && <p className="flex items-center justify-center gap-2 text-muted"><Loader2 size={18} className="animate-spin" /> Vérification du paiement…</p>}
      {state === "ok" && (
        <>
          <CheckCircle2 size={40} className="mx-auto text-success" />
          <h1 className="font-display text-2xl">C&apos;est activé</h1>
          <p className="text-ink-2">Tes avantages sont actifs tout de suite.</p>
          {retour ? (
            <Link href={retour} className="btn-primary">{retour.startsWith("/moments/") ? "Retrouver mon brouillon" : "Reprendre où j'en étais"}</Link>
          ) : (
            <Link href="/creer" className="btn-primary">Créer un Moment</Link>
          )}
        </>
      )}
      {state === "pending" && <p className="text-ink-2">Le paiement n&apos;est pas encore confirmé. Recharge cette page dans un instant.</p>}
      {state === "error" && <p role="alert" className="text-danger">{error}</p>}
      <p><Link href="/premium" className="text-sm text-muted underline-offset-2 hover:underline">Voir mon abonnement</Link></p>
    </section>
  );
}

export default function PremiumThanksPage() {
  return (
    <Suspense>
      <Confirm />
    </Suspense>
  );
}

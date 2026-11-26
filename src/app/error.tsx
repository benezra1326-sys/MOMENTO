"use client";

import { RefreshCw } from "lucide-react";

/** Aucune erreur (base injoignable comprise) ne doit laisser un écran blanc. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const db = /database|prisma|P10\d\d/i.test(error.message);
  return (
    <div className="card mx-auto mt-6 max-w-lg px-6 py-12 text-center">
      <h1 className="font-display text-2xl">{db ? "Service momentanément indisponible" : "Quelque chose s'est mal passé"}</h1>
      <p className="mt-2 text-muted">
        {db
          ? "Nous n'arrivons pas à joindre la base de données. Tes données ne sont pas perdues : réessaie dans un instant."
          : "Réessaie. Si le problème continue, recharge la page."}
      </p>
      {error.digest && <p className="mt-3 text-xs text-muted">Référence : {error.digest}</p>}
      <button type="button" onClick={reset} className="btn-primary mt-6">
        <RefreshCw size={16} /> Réessayer
      </button>
    </div>
  );
}

"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { useT } from "./I18nProvider";

/** Partage natif si disponible, sinon copie du lien. Aucune donnée privée dans le lien. */
export function ShareButton({ path, title, compact = false }: { path: string; title: string; compact?: boolean }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  async function share() {
    const url = new URL(path, window.location.origin).toString();
    if (navigator.share) {
      try {
        await navigator.share({ title, text: t("{title} — sur Upclose", { title }), url });
        return;
      } catch {
        /* annulé par l'utilisateur */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(t("Copie ce lien :"), url);
    }
  }
  if (compact) {
    return (
      <button type="button" onClick={share} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2" aria-label={copied ? t("Lien copié") : t("Partager ce Moment")}>
        {copied ? <Check size={18} className="text-success" /> : <Share2 size={18} />}
      </button>
    );
  }
  return (
    <button type="button" onClick={share} className="btn-secondary">
      {copied ? <Check size={18} className="text-success" /> : <Share2 size={18} />}
      {copied ? t("Lien copié") : t("Partager")}
    </button>
  );
}

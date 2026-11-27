"use client";

import { useT } from "./I18nProvider";
import { demoLabelsVisible } from "@/lib/env";


export function DemoBadge({ className = "" }: { className?: string }) {
  const t = useT();
  if (!demoLabelsVisible) return null;
  return (
    <span
      className={`pill bg-surface-2 text-accent ${className}`}
      title={t("Profil ou Moment fictif, créé pour la démonstration")}
    >
      {t("Démo")}
    </span>
  );
}

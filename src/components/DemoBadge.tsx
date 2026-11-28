"use client";

import { useT } from "./I18nProvider";
import { demoLabelsVisible } from "@/lib/env";


export function DemoBadge({ className = "" }: { className?: string }) {
  const t = useT();
  if (!demoLabelsVisible) return null;
  return (
    <span
      className={`pill bg-surface-2 text-accent ${className}`}
      title={t("Exemple fictif pour montrer l'app : on ne peut pas le rejoindre")}
    >
      {t("Exemple")}
    </span>
  );
}

"use client";

import { useT } from "./I18nProvider";

export function DemoBadge({ className = "" }: { className?: string }) {
  const t = useT();
  return (
    <span
      className={`pill bg-warn-soft text-warn ${className}`}
      title={t("Profil ou Moment fictif, créé pour la démonstration")}
    >
      {t("Démo")}
    </span>
  );
}

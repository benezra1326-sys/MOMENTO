"use client";

import Link from "next/link";
import { useT } from "./I18nProvider";
import { CloudOff, Lock, SearchX } from "lucide-react";

export function OfflineDemoNotice() {
  const t = useT();
  return (
    <div role="status" className="flex items-start gap-3 rounded-2xl border border-warn/20 bg-warn-soft px-4 py-3 text-sm text-warn">
      <CloudOff size={18} className="mt-0.5 shrink-0" />
      <p>
        <strong>{t("Mode démo hors ligne.")}</strong> {t("La base de données ne répond pas : tu vois les Moments de démonstration en lecture seule. Créer ou rejoindre un Moment sera possible dès que la base sera de retour.")}
      </p>
    </div>
  );
}

export function EmptyState({
  icon = "search",
  title,
  text,
  action,
}: {
  icon?: "search" | "lock";
  title: string;
  text?: string;
  action?: { href: string; label: string };
}) {
  const Icon = icon === "lock" ? Lock : SearchX;
  return (
    <div className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <Icon size={22} />
      </span>
      <h2 className="font-display text-xl">{title}</h2>
      {text && <p className="mt-2 max-w-sm text-sm text-muted">{text}</p>}
      {action && (
        <Link href={action.href} className="btn-ink mt-6">
          {action.label}
        </Link>
      )}
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-[clamp(1.8rem,5vw,2.6rem)] leading-tight">{title}</h1>
      </div>
      {children}
    </header>
  );
}

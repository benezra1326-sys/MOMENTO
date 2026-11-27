"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client";
import { formatRelative } from "@/lib/time";
import { useLocale, useT } from "./I18nProvider";

type Report = {
  id: string;
  reason: string;
  details: string;
  status: string;
  createdAt: string;
  reporter: { username: string; name: string };
  target: { id: string; username: string; name: string; status: string } | null;
  moment: { id: string; title: string; status: string } | null;
};

const reasonLabel: Record<string, string> = {
  spam: "Spam", harassment: "Harcèlement", inappropriate: "Contenu inapproprié", safety: "Sécurité", fake: "Faux profil / Moment", other: "Autre",
};

export function AdminReports({ reports, status }: { reports: Report[]; status: "OPEN" | "RESOLVED" }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: string) {
    const note = action === "dismiss" ? "" : window.prompt(t("Note interne (facultatif) :")) ?? "";
    setBusy(id);
    setError(null);
    const res = await api(`/api/admin/reports/${id}`, { body: { action, note } });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Link href="/admin" className={`chip ${status === "OPEN" ? "chip-active" : ""}`}>{t("À traiter")}</Link>
        <Link href="/admin?statut=traites" className={`chip ${status !== "OPEN" ? "chip-active" : ""}`}>{t("Traités")}</Link>
      </div>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      {reports.length === 0 ? (
        <div className="card px-6 py-10 text-center text-muted">{status === "OPEN" ? t("Aucun signalement en attente.") : t("Aucun signalement traité.")}</div>
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => (
            <li key={r.id} className="card space-y-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="pill bg-danger-soft text-danger">{t(reasonLabel[r.reason] ?? r.reason)}</span>
                <span className="text-xs text-muted">{t("par @{u}", { u: r.reporter.username })} · {formatRelative(r.createdAt, locale)}</span>
              </div>
              {r.moment && <p className="text-sm">{t("Moment :")} <Link className="font-semibold text-accent underline" href={`/moments/${r.moment.id}`}>{r.moment.title}</Link> ({r.moment.status})</p>}
              {r.target && <p className="text-sm">{t("Profil :")} <Link className="font-semibold text-accent underline" href={`/u/${r.target.username}`}>@{r.target.username}</Link> ({r.target.status})</p>}
              {r.details && <p className="text-sm text-ink-2">« {r.details} »</p>}
              {status === "OPEN" && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button type="button" className="btn-ghost !min-h-9 text-sm" disabled={busy === r.id} onClick={() => act(r.id, "dismiss")}>{t("Classer sans suite")}</button>
                  <button type="button" className="btn-secondary !min-h-9 text-sm" disabled={busy === r.id} onClick={() => act(r.id, "resolve")}>{t("Marquer traité")}</button>
                  {r.moment && <button type="button" className="btn-danger !min-h-9 text-sm" disabled={busy === r.id} onClick={() => act(r.id, "cancel_moment")}>{t("Retirer le Moment")}</button>}
                  {r.target && <button type="button" className="btn-danger !min-h-9 text-sm" disabled={busy === r.id} onClick={() => act(r.id, "suspend_user")}>{t("Suspendre le compte")}</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-muted">{t("Chaque suspension ou retrait est inscrit au journal d'audit.")}</p>
    </div>
  );
}

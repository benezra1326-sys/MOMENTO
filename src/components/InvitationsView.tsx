"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { Loader2 } from "lucide-react";
import type { MomentCardDTO, PersonSummary } from "@/server/types";
import { api } from "@/lib/client";
import { formatMomentDate, formatMomentTime, formatRelative } from "@/lib/time";
import type { DispoSnapshot } from "@/server/availability";
import { Avatar } from "./Avatar";
import { DispoQuote } from "./DispoQuote";
import { MomentMedia } from "./MomentMedia";
import { useLocale, useT } from "./I18nProvider";

type Row = {
  id: string;
  kind: "REQUEST" | "INVITE";
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED";
  message: string | null;
  dispo?: DispoSnapshot | null;
  createdAt: string;
  respondedAt: string | null;
  user: PersonSummary;
  moment: MomentCardDTO;
};

export type InvitationsData = {
  invitationsReceived: Row[];
  requestsSent: Row[];
  requestsToReview: Row[];
  hostActivity: Row[];
  upcoming: Row[];
};

const tabs = [
  { id: "agenda", label: "Agenda" },
  { id: "recues", label: "Reçues" },
  { id: "envoyees", label: "Envoyées" },
  { id: "hote", label: "Mes Moments" },
] as const;

type Tab = (typeof tabs)[number]["id"];

const statusPill: Record<Row["status"], { text: string; cls: string }> = {
  PENDING: { text: "En attente", cls: "bg-lilac/10 text-accent" },
  ACCEPTED: { text: "Confirmé", cls: "bg-success-soft text-success" },
  DECLINED: { text: "Décliné", cls: "bg-lilac/10 text-muted" },
  CANCELLED: { text: "Retiré", cls: "bg-lilac/10 text-muted" },
};

export function InvitationsView({ data: raw, initialTab }: { data: InvitationsData; initialTab?: string }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [overrides, setOverrides] = useState<Record<string, Row["status"]>>({});
  const fix = (rows: Row[]) => rows.map((r) => (overrides[r.id] ? { ...r, status: overrides[r.id] } : r));
  const data: InvitationsData = {
    invitationsReceived: fix(raw.invitationsReceived),
    requestsSent: fix(raw.requestsSent),
    requestsToReview: fix(raw.requestsToReview).filter((r) => r.status === "PENDING"),
    hostActivity: fix(raw.hostActivity),
    upcoming: fix(raw.upcoming).filter((r) => r.status === "ACCEPTED"),
  };
  const counts: Record<Tab, number> = {
    agenda: data.upcoming.length,
    recues: data.invitationsReceived.filter((r) => r.status === "PENDING").length,
    envoyees: data.requestsSent.filter((r) => r.status === "PENDING").length,
    hote: data.requestsToReview.length,
  };
  const first: Tab = (tabs.find((x) => x.id === initialTab)?.id as Tab) ?? (counts.hote ? "hote" : counts.recues ? "recues" : "agenda");
  const [tab, setTab] = useState<Tab>(first);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "accept" | "decline" | "cancel") {
    setBusy(`${id}-${action}`);
    setError(null);
    const res = await api(`/api/requests/${id}/${action}`, { body: {} });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    setOverrides((o) => ({ ...o, [id]: action === "accept" ? "ACCEPTED" : action === "decline" ? "DECLINED" : "CANCELLED" }));
    startTransition(() => router.refresh());
  }

  const btn = (id: string, action: "accept" | "decline" | "cancel", label: string, cls: string, disabled = false) => (
    <button type="button" className={`${cls} !min-h-9 !px-3.5 text-sm`} disabled={!!busy || disabled} onClick={() => act(id, action)}>
      {busy === `${id}-${action}` && <Loader2 size={14} className="animate-spin" />} {t(label)}
    </button>
  );

  const card = (r: Row, opts: { person?: boolean; actions?: React.ReactNode; mineDispo?: boolean }) => {
    const m = r.moment;
    return (
      <li key={r.id} className="card flex gap-4 p-3 sm:p-4">
        <Link href={`/moments/${m.id}`} className="relative aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-2xl bg-night sm:w-24" aria-label={t(m.title)}>
          <MomentMedia moment={m} autoplay={false} sizes="96px" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/moments/${m.id}`} className="font-semibold leading-snug hover:underline">{t(m.title)}</Link>
            <span className={`pill shrink-0 ${statusPill[r.status].cls}`}>{m.phase === "cancelled" ? t("Annulé") : r.status === "PENDING" && m.phase === "ended" ? t("Expirée") : t(statusPill[r.status].text)}</span>
          </div>
          <p className="mt-0.5 text-sm text-muted">
            <span className="capitalize">{formatMomentDate(m.startsAt, m.timezone, locale)}</span> · {formatMomentTime(m.startsAt, m.timezone, locale)} · {t(m.area) || m.city}
          </p>
          {opts.person && (
            <div className="mt-2 flex items-center gap-2 text-sm">
              <Avatar person={r.user} size="xs" />
              <Link href={`/u/${r.user.username}`} className="font-medium hover:underline">{r.user.name}</Link>
              <span className="text-muted">· {formatRelative(r.createdAt, locale)}</span>
            </div>
          )}
          {opts.mineDispo && (
            <p className="mt-1.5 flex items-center gap-2 text-sm">
              <Avatar person={m.host} size="xs" />
              <span>{t("{name} t'invite", { name: m.host.name })}</span>
            </p>
          )}
          {r.message && <p className="mt-1.5 line-clamp-2 text-sm text-ink-2">« {t(r.message)} »</p>}
          {r.dispo && (
            <DispoQuote
              dispo={r.dispo}
              title={opts.mineDispo ? t("En réponse à ta dispo") : t("Sa dispo : {name}", { name: r.user.name.split(" ")[0] })}
              className="mt-2"
            />
          )}
          {opts.actions && <div className="mt-3 flex flex-wrap gap-2">{opts.actions}</div>}
        </div>
      </li>
    );
  };

  const empty = (text: string, cta?: { href: string; label: string }) => (
    <div className="card px-6 py-10 text-center">
      <p className="text-muted">{t(text)}</p>
      {cta && <Link href={cta.href} className="btn-ink mt-4">{t(cta.label)}</Link>}
    </div>
  );

  return (
    <div>
      <div role="tablist" aria-label={t("Invitations")} className="mb-5 flex flex-wrap gap-2">
        {tabs.map((x) => (
          <button key={x.id} role="tab" type="button" aria-selected={tab === x.id} onClick={() => setTab(x.id)} className={`chip ${tab === x.id ? "chip-active" : ""}`}>
            {t(x.label)}
            {counts[x.id] > 0 && <span className={`rounded-full px-1.5 text-xs ${tab === x.id ? "bg-night text-cream" : "bg-coral text-night"}`}>{counts[x.id]}</span>}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>}

      <div role="tabpanel">
        {tab === "agenda" &&
          (data.upcoming.length ? (
            <ul className="space-y-3">{data.upcoming.map((r) => card(r, { actions: btn(r.id, "cancel", "Je ne peux plus venir", "btn-ghost text-muted") }))}</ul>
          ) : (
            empty("Aucun Moment confirmé à venir.", { href: "/", label: "Trouver un Moment" })
          ))}

        {tab === "recues" &&
          (data.invitationsReceived.length ? (
            <ul className="space-y-3">
              {data.invitationsReceived.map((r) =>
                card(r, {
                  person: false,
                  mineDispo: true,
                  actions:
                    r.status === "PENDING" && r.moment.phase !== "cancelled" && r.moment.phase !== "ended" ? (
                      <>
                        {btn(r.id, "decline", "Décliner", "btn-secondary")}
                        {btn(r.id, "accept", "Accepter", "btn-primary", r.moment.spotsLeft === 0)}
                      </>
                    ) : undefined,
                }),
              )}
            </ul>
          ) : (
            empty("Personne ne t'a encore invité. Les invitations des hôtes apparaîtront ici.")
          ))}

        {tab === "envoyees" &&
          (data.requestsSent.length ? (
            <ul className="space-y-3">
              {data.requestsSent.map((r) =>
                card(r, {
                  actions: r.status === "PENDING" && r.moment.phase !== "ended" && r.moment.phase !== "cancelled" ? btn(r.id, "cancel", "Retirer ma demande", "btn-secondary") : undefined,
                }),
              )}
            </ul>
          ) : (
            empty("Tu n'as envoyé aucune demande.", { href: "/", label: "Explorer le feed" })
          ))}

        {tab === "hote" && (
          <div className="space-y-6">
            <section>
              <h2 className="mb-3 font-semibold">{t("Demandes à traiter")}</h2>
              {data.requestsToReview.length ? (
                <ul className="space-y-3">
                  {data.requestsToReview.map((r) =>
                    card(r, {
                      person: true,
                      actions: (
                        <>
                          {btn(r.id, "decline", "Refuser", "btn-secondary")}
                          {btn(r.id, "accept", "Accepter", "btn-primary", r.moment.spotsLeft === 0)}
                        </>
                      ),
                    }),
                  )}
                </ul>
              ) : (
                empty("Aucune demande en attente sur tes Moments.", { href: "/moments/nouveau", label: "Créer un Moment" })
              )}
            </section>
            {data.hostActivity.length > 0 && (
              <section>
                <h2 className="mb-3 font-semibold">{t("Activité récente")}</h2>
                <ul className="space-y-3">
                  {data.hostActivity.slice(0, 20).map((r) =>
                    card(r, { person: true, actions: r.kind === "INVITE" && r.status === "PENDING" && r.moment.phase !== "ended" && r.moment.phase !== "cancelled" ? btn(r.id, "cancel", "Retirer l'invitation", "btn-ghost text-muted") : undefined }),
                  )}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

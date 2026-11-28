"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { Ban, Loader2, Pencil, Rocket, Send, UserPlus } from "lucide-react";
import type { MemberRow, MomentDetailDTO } from "@/server/types";
import { api } from "@/lib/client";
import { formatRelative } from "@/lib/time";
import { Avatar } from "./Avatar";
import { useLocale, useT } from "./I18nProvider";

const statusText: Record<string, string> = {
  ACCEPTED: "Confirmé",
  PENDING: "En attente",
  DECLINED: "Décliné",
  CANCELLED: "Retiré",
};

export function HostPanel({ moment }: { moment: MomentDetailDTO }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitee, setInvitee] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ username: string; name: string; photoUrl: string | null; city: string }[]>([]);
  const inviteQuery = invitee.trim().replace(/^@/, "");
  useEffect(() => {
    if (inviteQuery.length < 1) return;
    let live = true;
    const timer = setTimeout(async () => {
      const res = await api<typeof suggestions>(`/api/users/search?q=${encodeURIComponent(inviteQuery)}`);
      if (live && res.ok) setSuggestions(res.data.filter((p) => !(moment.members ?? []).some((m) => m.user.username === p.username && (m.status === "ACCEPTED" || m.status === "PENDING"))));
    }, 200);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [inviteQuery, moment.members]);
  const shownSuggestions = inviteQuery.length > 0 && !suggestions.some((p) => p.username === inviteQuery.toLowerCase()) ? suggestions : [];
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [overrides, setOverrides] = useState<Record<string, MemberRow["status"]>>({});
  const members = (moment.members ?? []).map((m) => (overrides[m.id] ? { ...m, status: overrides[m.id] } : m));
  const acceptedNow = members.filter((m) => m.status === "ACCEPTED").length;
  const spotsLeft = Math.max(0, moment.capacity - acceptedNow);
  const requests = members.filter((m) => m.kind === "REQUEST" && m.status === "PENDING");
  const confirmed = members.filter((m) => m.status === "ACCEPTED");
  const invited = members.filter((m) => m.kind === "INVITE" && m.status === "PENDING");
  const others = members.filter((m) => m.status === "DECLINED" || m.status === "CANCELLED");
  const open = moment.phase === "upcoming" || moment.phase === "ongoing";

  async function run(key: string, url: string, body: unknown = {}, okMsg?: string, apply?: () => void) {
    setBusy(key);
    setError(null);
    setNotice(null);
    const res = await api(url, { body });
    setBusy(null);
    if (!res.ok) {
      setError(res.error.message);
      return false;
    }
    if (okMsg) setNotice(okMsg);
    apply?.();
    startTransition(() => router.refresh());
    return true;
  }

  const row = (m: MemberRow, actions?: React.ReactNode) => (
    <li key={m.id} className="flex items-center gap-3 py-3">
      <Link href={`/u/${m.user.username}`}><Avatar person={m.user} size="md" /></Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${m.user.username}`} className="flex items-center gap-1.5 truncate font-semibold hover:underline">
          {m.user.name}
          {m.premium && <span className="pill bg-accent/15 !py-0 text-[11px] text-ink">Upclose+</span>}
        </Link>
        {m.message ? <p className="line-clamp-2 text-sm text-ink-2">« {t(m.message)} »</p> : <p className="text-xs text-muted">{m.kind === "INVITE" ? t("Invité·e") : t("Demande")} {formatRelative(m.createdAt, locale)}</p>}
      </div>
      {actions ?? <span className="pill bg-lilac/10 text-ink-2">{t(statusText[m.status])}</span>}
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {moment.phase === "draft" && (
          <button type="button" className="btn-primary" disabled={!!busy} onClick={() => run("publish", `/api/moments/${moment.id}/publish`, {}, t("Moment publié."))}>
            {busy === "publish" && <Loader2 size={16} className="animate-spin" />} {t("Publier")}
          </button>
        )}
        {moment.phase === "upcoming" && moment.status === "PUBLISHED" && (
          moment.boostedUntil ? (
            <span className="pill bg-accent/15 text-ink"><Rocket size={14} /> {t("Boosté jusqu'à {time}", { time: new Date(moment.boostedUntil).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", weekday: "short" }) })}</span>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={!!busy}
              onClick={async () => {
                setBusy("boost");
                setError(null);
                const res = await api(`/api/moments/${moment.id}/boost`, { body: {} });
                setBusy(null);
                if (!res.ok) {
                  if (res.error.code === "PREMIUM_REQUIRED") router.push("/premium");
                  else setError(res.error.message);
                  return;
                }
                setNotice(t("Ton Moment est en tête du feed pendant 24 h."));
                startTransition(() => router.refresh());
              }}
            >
              {busy === "boost" ? <Loader2 size={16} className="animate-spin" /> : <Rocket size={16} />} {t("Booster")}
            </button>
          )
        )}
        {(open || moment.phase === "draft") && (
          <Link href={`/moments/${moment.id}/modifier`} className="btn-secondary"><Pencil size={16} /> {t("Modifier")}</Link>
        )}
        {open && (
          <button type="button" className="btn-danger" onClick={() => setShowCancel((v) => !v)} aria-expanded={showCancel}>
            <Ban size={16} /> {t("Annuler le Moment")}
          </button>
        )}
      </div>

      {showCancel && (
        <form
          className="space-y-3 rounded-2xl border border-danger/20 bg-danger-soft/50 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (await run("cancel", `/api/moments/${moment.id}/cancel`, { reason: reason || null })) setShowCancel(false);
          }}
        >
          <p className="text-sm">
            {t(confirmed.length > 1 ? "Les {n} participants et les demandes en attente seront prévenus. Cette action est définitive." : "Les {n} participant et les demandes en attente seront prévenus. Cette action est définitive.", { n: confirmed.length })}
          </p>
          <label htmlFor="cancel-reason" className="field-label">{t("Motif (facultatif, visible par les participants)")}</label>
          <input id="cancel-reason" className="input" maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("Ex. : météo, imprévu…")} />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setShowCancel(false)}>{t("Garder le Moment")}</button>
            <button type="submit" className="btn bg-danger text-night hover:bg-danger/90 inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold" disabled={!!busy}>
              {busy === "cancel" && <Loader2 size={16} className="animate-spin" />} {t("Confirmer l'annulation")}
            </button>
          </div>
        </form>
      )}

      {notice && <p role="status" className="rounded-2xl bg-success-soft px-4 py-2.5 text-sm text-success">{notice}</p>}
      {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>}

      <section aria-labelledby="req-title">
        <h3 id="req-title" className="font-semibold">{t("Demandes à traiter")} <span className="text-muted">({requests.length})</span></h3>
        {requests.length === 0 ? (
          <p className="mt-1 text-sm text-muted">{t("Aucune demande en attente.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {requests.map((m) =>
              row(
                m,
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" className="btn-secondary !min-h-9 !px-3 text-sm" disabled={!!busy} onClick={() => run(`d-${m.id}`, `/api/requests/${m.id}/decline`, {}, undefined, () => setOverrides((o) => ({ ...o, [m.id]: "DECLINED" })))} aria-label={t("Refuser la demande de {name}", { name: m.user.name })}>
                    {busy === `d-${m.id}` ? <Loader2 size={14} className="animate-spin" /> : t("Refuser")}
                  </button>
                  <button type="button" className="btn-primary !min-h-9 !px-3 text-sm" disabled={!!busy || spotsLeft === 0} onClick={() => run(`a-${m.id}`, `/api/requests/${m.id}/accept`, {}, undefined, () => setOverrides((o) => ({ ...o, [m.id]: "ACCEPTED" })))} aria-label={t("Accepter la demande de {name}", { name: m.user.name })}>
                    {busy === `a-${m.id}` ? <Loader2 size={14} className="animate-spin" /> : t("Accepter")}
                  </button>
                </div>,
              ),
            )}
          </ul>
        )}
        {requests.length > 0 && spotsLeft === 0 && <p className="mt-2 text-sm text-warn">{t("Le Moment est complet : augmente la capacité pour accepter d'autres personnes.")}</p>}
      </section>

      {open && (
        <section aria-labelledby="inv-title">
          <h3 id="inv-title" className="font-semibold">{t("Inviter quelqu'un")}</h3>
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("invite", `/api/moments/${moment.id}/invitations`, { username: invitee }, t("Invitation envoyée à @{u}.", { u: invitee.replace(/^@/, "") }))) setInvitee("");
            }}
          >
            <label htmlFor="invitee" className="sr-only">{t("Pseudo de la personne à inviter")}</label>
            <div className="relative flex-1">
              <UserPlus size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="invitee" className="input !pl-10" placeholder={t("Nom ou @pseudo")} value={invitee} onChange={(e) => setInvitee(e.target.value)} autoComplete="off" autoCapitalize="none" role="combobox" aria-expanded={shownSuggestions.length > 0} aria-controls="invitee-list" />
              {shownSuggestions.length > 0 && (
                <ul id="invitee-list" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg">
                  {shownSuggestions.map((p) => (
                    <li key={p.username} role="option" aria-selected={false}>
                      <button type="button" className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2/60" onClick={() => setInvitee(p.username)}>
                        <Avatar person={p} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{p.name}</span>
                          <span className="block truncate text-xs text-muted">@{p.username}{p.city ? ` · ${p.city}` : ""}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="submit" className="btn-primary" disabled={!invitee.trim() || !!busy}>
              {busy === "invite" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="hidden sm:inline">{t("Inviter")}</span>
            </button>
          </form>
          <p className="field-help">{t("Ou partage le lien du Moment : les personnes demanderont à le rejoindre.")}</p>
        </section>
      )}

      {invited.length > 0 && (
        <section>
          <h3 className="font-semibold">{t("Invitations en attente")}</h3>
          <ul className="divide-y divide-border">
            {invited.map((m) =>
              row(
                m,
                <button type="button" className="btn-ghost !min-h-9 !px-3 text-sm text-muted" disabled={!!busy} onClick={() => run(`w-${m.id}`, `/api/requests/${m.id}/cancel`, {}, undefined, () => setOverrides((o) => ({ ...o, [m.id]: "CANCELLED" })))}>
                  {t("Retirer")}
                </button>,
              ),
            )}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-semibold">{t("Participants confirmés")} <span className="text-muted">({confirmed.length}/{moment.capacity})</span></h3>
        {confirmed.length === 0 ? <p className="mt-1 text-sm text-muted">{t("Personne pour l'instant.")}</p> : <ul className="divide-y divide-border">{confirmed.map((m) => row(m))}</ul>}
      </section>

      {others.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted">{t("Historique")} ({others.length})</summary>
          <ul className="divide-y divide-border">{others.map((m) => row(m))}</ul>
        </details>
      )}
    </div>
  );
}

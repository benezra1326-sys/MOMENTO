"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, Loader2, Pencil, Send, UserPlus } from "lucide-react";
import type { MemberRow, MomentDetailDTO } from "@/server/types";
import { api } from "@/lib/client";
import { formatRelative } from "@/lib/time";
import { Avatar } from "./Avatar";

const statusText: Record<string, string> = {
  ACCEPTED: "Confirmé",
  PENDING: "En attente",
  DECLINED: "Décliné",
  CANCELLED: "Retiré",
};

export function HostPanel({ moment }: { moment: MomentDetailDTO }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitee, setInvitee] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const members = moment.members ?? [];
  const requests = members.filter((m) => m.kind === "REQUEST" && m.status === "PENDING");
  const confirmed = members.filter((m) => m.status === "ACCEPTED");
  const invited = members.filter((m) => m.kind === "INVITE" && m.status === "PENDING");
  const others = members.filter((m) => m.status === "DECLINED" || m.status === "CANCELLED");
  const open = moment.phase === "upcoming" || moment.phase === "ongoing";

  async function run(key: string, url: string, body: unknown = {}, okMsg?: string) {
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
    router.refresh();
    return true;
  }

  const row = (m: MemberRow, actions?: React.ReactNode) => (
    <li key={m.id} className="flex items-center gap-3 py-3">
      <Link href={`/u/${m.user.username}`}><Avatar person={m.user} size="md" /></Link>
      <div className="min-w-0 flex-1">
        <Link href={`/u/${m.user.username}`} className="block truncate font-semibold hover:underline">{m.user.name}</Link>
        {m.message ? <p className="line-clamp-2 text-sm text-ink-soft">« {m.message} »</p> : <p className="text-xs text-muted">{m.kind === "INVITE" ? "Invité·e" : "Demande"} {formatRelative(m.createdAt)}</p>}
      </div>
      {actions ?? <span className="pill bg-sand text-ink-soft">{statusText[m.status]}</span>}
    </li>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {moment.phase === "draft" && (
          <button type="button" className="btn-accent" disabled={!!busy} onClick={() => run("publish", `/api/moments/${moment.id}/publish`, {}, "Moment publié.")}>
            {busy === "publish" && <Loader2 size={16} className="animate-spin" />} Publier
          </button>
        )}
        {(open || moment.phase === "draft") && (
          <Link href={`/moments/${moment.id}/modifier`} className="btn-secondary"><Pencil size={16} /> Modifier</Link>
        )}
        {open && (
          <button type="button" className="btn-danger" onClick={() => setShowCancel((v) => !v)} aria-expanded={showCancel}>
            <Ban size={16} /> Annuler le Moment
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
            Les {confirmed.length} participant{confirmed.length > 1 ? "s" : ""} et les demandes en attente seront prévenus. Cette action est définitive.
          </p>
          <label htmlFor="cancel-reason" className="field-label">Motif (facultatif, visible par les participants)</label>
          <input id="cancel-reason" className="input" maxLength={280} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex. : météo, imprévu…" />
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setShowCancel(false)}>Garder le Moment</button>
            <button type="submit" className="btn bg-danger text-white hover:bg-danger/90 inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold" disabled={!!busy}>
              {busy === "cancel" && <Loader2 size={16} className="animate-spin" />} Confirmer l&apos;annulation
            </button>
          </div>
        </form>
      )}

      {notice && <p role="status" className="rounded-2xl bg-success-soft px-4 py-2.5 text-sm text-success">{notice}</p>}
      {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{error}</p>}

      <section aria-labelledby="req-title">
        <h3 id="req-title" className="font-semibold">Demandes à traiter <span className="text-muted">({requests.length})</span></h3>
        {requests.length === 0 ? (
          <p className="mt-1 text-sm text-muted">Aucune demande en attente.</p>
        ) : (
          <ul className="divide-y divide-line">
            {requests.map((m) =>
              row(
                m,
                <div className="flex shrink-0 gap-1.5">
                  <button type="button" className="btn-secondary !min-h-9 !px-3 text-sm" disabled={!!busy} onClick={() => run(`d-${m.id}`, `/api/requests/${m.id}/decline`)} aria-label={`Refuser la demande de ${m.user.name}`}>
                    {busy === `d-${m.id}` ? <Loader2 size={14} className="animate-spin" /> : "Refuser"}
                  </button>
                  <button type="button" className="btn-primary !min-h-9 !px-3 text-sm" disabled={!!busy || moment.spotsLeft === 0} onClick={() => run(`a-${m.id}`, `/api/requests/${m.id}/accept`)} aria-label={`Accepter la demande de ${m.user.name}`}>
                    {busy === `a-${m.id}` ? <Loader2 size={14} className="animate-spin" /> : "Accepter"}
                  </button>
                </div>,
              ),
            )}
          </ul>
        )}
        {requests.length > 0 && moment.spotsLeft === 0 && <p className="mt-2 text-sm text-warn">Le Moment est complet : augmente la capacité pour accepter d&apos;autres personnes.</p>}
      </section>

      {open && (
        <section aria-labelledby="inv-title">
          <h3 id="inv-title" className="font-semibold">Inviter quelqu&apos;un</h3>
          <form
            className="mt-2 flex gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run("invite", `/api/moments/${moment.id}/invitations`, { username: invitee }, `Invitation envoyée à @${invitee.replace(/^@/, "")}.`)) setInvitee("");
            }}
          >
            <label htmlFor="invitee" className="sr-only">Pseudo de la personne à inviter</label>
            <div className="relative flex-1">
              <UserPlus size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" aria-hidden />
              <input id="invitee" className="input !pl-10" placeholder="@pseudo" value={invitee} onChange={(e) => setInvitee(e.target.value)} autoComplete="off" autoCapitalize="none" />
            </div>
            <button type="submit" className="btn-primary" disabled={!invitee.trim() || !!busy}>
              {busy === "invite" ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              <span className="hidden sm:inline">Inviter</span>
            </button>
          </form>
          <p className="field-help">Ou partage le lien du Moment : les personnes demanderont à le rejoindre.</p>
        </section>
      )}

      {invited.length > 0 && (
        <section>
          <h3 className="font-semibold">Invitations en attente</h3>
          <ul className="divide-y divide-line">
            {invited.map((m) =>
              row(
                m,
                <button type="button" className="btn-ghost !min-h-9 !px-3 text-sm text-muted" disabled={!!busy} onClick={() => run(`w-${m.id}`, `/api/requests/${m.id}/cancel`)}>
                  Retirer
                </button>,
              ),
            )}
          </ul>
        </section>
      )}

      <section>
        <h3 className="font-semibold">Participants confirmés <span className="text-muted">({confirmed.length}/{moment.capacity})</span></h3>
        {confirmed.length === 0 ? <p className="mt-1 text-sm text-muted">Personne pour l&apos;instant.</p> : <ul className="divide-y divide-line">{confirmed.map((m) => row(m))}</ul>}
      </section>

      {others.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-muted">Historique ({others.length})</summary>
          <ul className="divide-y divide-line">{others.map((m) => row(m))}</ul>
        </details>
      )}
    </div>
  );
}

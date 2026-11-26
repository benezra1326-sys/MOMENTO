"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Clock, Loader2, Lock, XCircle } from "lucide-react";
import type { MomentDetailDTO } from "@/server/types";
import { api } from "@/lib/client";

export function JoinPanel({ moment, signedIn, readOnly = false }: { moment: MomentDetailDTO; signedIn: boolean; readOnly?: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [showOnMoment, setShowOnMoment] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ms = moment.viewerMembership;

  async function run(key: string, url: string, body: unknown = {}) {
    setBusy(key);
    setError(null);
    const res = await api(url, { body });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    router.refresh();
  }

  const box = (tone: "ok" | "wait" | "off" | "lock", title: string, text?: string, actions?: React.ReactNode) => {
    const Icon = { ok: CheckCircle2, wait: Clock, off: XCircle, lock: Lock }[tone];
    const color = { ok: "text-success bg-success-soft", wait: "text-violet bg-violet-soft", off: "text-muted bg-sand", lock: "text-ink-soft bg-sand" }[tone];
    return (
      <div className="space-y-4">
        <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${color}`}>
          <Icon size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-ink">{title}</p>
            {text && <p className="mt-0.5 text-sm text-ink-soft">{text}</p>}
          </div>
        </div>
        {actions}
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
    );
  };

  if (readOnly) return box("lock", "Lecture seule", "Le mode démo hors ligne ne permet pas de rejoindre un Moment.");
  if (moment.phase === "cancelled") return box("off", "Ce Moment a été annulé", moment.cancelReason ?? undefined);
  if (moment.phase === "ended") return box("off", "Ce Moment est terminé", "Envie de remettre ça ? Crée le prochain.");
  if (moment.phase === "draft") return box("lock", "Brouillon", "Ce Moment n'est pas encore publié.");

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <Link href={`/connexion?suite=/moments/${moment.id}`} className="btn-accent w-full">
          {moment.visibility === "PUBLIC" ? "Rejoindre ce Moment" : "Demander à rejoindre"}
        </Link>
        <p className="text-center text-sm text-muted">Connecte-toi ou crée un compte en 30 secondes.</p>
      </div>
    );
  }

  if (ms?.status === "ACCEPTED") {
    return box(
      "ok",
      "Ta place est confirmée",
      moment.address ? "L'adresse exacte est visible ci-dessous." : "À bientôt sur place !",
      <button type="button" className="btn-ghost w-full text-muted" disabled={!!busy} onClick={() => confirm("Libérer ta place ? L'hôte sera prévenu.") && run("leave", `/api/requests/${ms.id}/cancel`)}>
        {busy === "leave" && <Loader2 size={16} className="animate-spin" />} Je ne peux plus venir
      </button>,
    );
  }
  if (ms?.status === "PENDING" && ms.kind === "REQUEST") {
    return box(
      "wait",
      "Demande envoyée",
      "L'hôte te répondra ici et par notification. Aucune relance automatique ne lui est envoyée.",
      <button type="button" className="btn-secondary w-full" disabled={!!busy} onClick={() => run("withdraw", `/api/requests/${ms.id}/cancel`)}>
        {busy === "withdraw" && <Loader2 size={16} className="animate-spin" />} Retirer ma demande
      </button>,
    );
  }
  if (ms?.status === "PENDING" && ms.kind === "INVITE") {
    return box(
      "wait",
      `${moment.host.name} t'invite`,
      "Tu es libre d'accepter ou non, l'hôte ne verra qu'un simple « décliné ».",
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => run("decline", `/api/requests/${ms.id}/decline`)}>
          {busy === "decline" && <Loader2 size={16} className="animate-spin" />} Décliner
        </button>
        <button type="button" className="btn-accent" disabled={!!busy || moment.spotsLeft === 0} onClick={() => run("accept", `/api/requests/${ms.id}/accept`)}>
          {busy === "accept" && <Loader2 size={16} className="animate-spin" />} Accepter
        </button>
      </div>,
    );
  }
  if (ms?.status === "DECLINED") {
    return ms.kind === "REQUEST"
      ? box("off", "L'hôte n'a pas pu accepter ta demande", "Ça arrive : le groupe était peut-être déjà constitué. D'autres Moments t'attendent.", <Link href="/" className="btn-secondary w-full">Voir d&apos;autres Moments</Link>)
      : box("off", "Tu as décliné cette invitation");
  }
  if (moment.visibility === "INVITE_ONLY") return box("lock", "Sur invitation uniquement", "Seul l'hôte peut inviter des participants.");
  if (moment.spotsLeft === 0) return box("off", "Ce Moment est complet", "Une place peut se libérer : repasse plus tard.");

  const instant = moment.visibility === "PUBLIC";
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run("join", `/api/moments/${moment.id}/join-requests`, { message: message || null, showOnMoment });
      }}
    >
      {!instant && (
        <div>
          <label htmlFor="join-msg" className="field-label">Un mot pour l&apos;hôte <span className="font-normal text-muted">(facultatif)</span></label>
          <textarea id="join-msg" className="input min-h-24" maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Présente-toi en une phrase…" />
        </div>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-violet)]" checked={showOnMoment} onChange={(e) => setShowOnMoment(e.target.checked)} />
        <span>Apparaître dans la liste des participants visible par les autres</span>
      </label>
      <button type="submit" className="btn-accent w-full" disabled={!!busy}>
        {busy === "join" && <Loader2 size={16} className="animate-spin" />}
        {instant ? "Rejoindre ce Moment" : "Demander à rejoindre"}
      </button>
      <p className="text-center text-xs text-muted">
        {instant ? "Accès ouvert : ta place est confirmée tout de suite." : "Ta place sera confirmée seulement si l'hôte accepte."}
      </p>
      {error && <p role="alert" className="field-error text-center">{error}</p>}
    </form>
  );
}

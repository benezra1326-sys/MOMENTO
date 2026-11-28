"use client";

import { demoLabelsVisible } from "@/lib/env";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";
import { CheckCircle2, Clock, Loader2, Lock, XCircle } from "lucide-react";
import type { MomentDetailDTO, ViewerMembership } from "@/server/types";
import { api } from "@/lib/client";
import { useT } from "./I18nProvider";

export function JoinPanel({ moment, signedIn, readOnly = false, viewerIsDemo = false, viewerIsBlack = false }: { moment: MomentDetailDTO; signedIn: boolean; readOnly?: boolean; viewerIsDemo?: boolean; viewerIsBlack?: boolean }) {
  const router = useRouter();
  const t = useT();
  const [message, setMessage] = useState("");
  const [showOnMoment, setShowOnMoment] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // État local mis à jour dès la réponse du serveur (le rafraîchissement suit en arrière-plan).
  const [local, setLocal] = useState<{ ms: ViewerMembership; spotsDelta: number } | null>(null);
  const ms = local ? local.ms : moment.viewerMembership;

  async function run(key: string, url: string, body: unknown = {}) {
    setBusy(key);
    setError(null);
    const res = await api<{ id: string; status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" }>(url, { body });
    setBusy(null);
    if (!res.ok) {
      if (res.error.code === "CERTIFICATION_REQUIRED") return router.push(`/moi/certification?retour=${encodeURIComponent(`/moments/${moment.id}`)}`);
      return setError(res.error.message);
    }
    const prev = ms;
    const kind = key === "join" ? "REQUEST" : prev?.kind ?? "REQUEST";
    const next: ViewerMembership = res.data.status === "CANCELLED" ? null : { id: res.data.id, kind, status: res.data.status, initiatedByViewer: kind === "REQUEST" };
    setLocal({ ms: next, spotsDelta: 0 });
    startTransition(() => router.refresh());
  }

  const box = (tone: "ok" | "wait" | "off" | "lock", title: string, text?: string, actions?: React.ReactNode) => {
    const Icon = { ok: CheckCircle2, wait: Clock, off: XCircle, lock: Lock }[tone];
    const color = { ok: "text-ink bg-lilac/10", wait: "text-accent bg-lilac/10", off: "text-muted bg-lilac/10", lock: "text-ink-2 bg-lilac/10" }[tone];
    return (
      <div className="space-y-4">
        <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${color}`}>
          {tone === "ok" ? (
            // Place confirmée : un des rares moments forts, marqué par le dégradé signature.
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-signature text-white" aria-hidden>
              <Icon size={16} />
            </span>
          ) : (
            <Icon size={20} className="mt-0.5 shrink-0" />
          )}
          <div>
            <p className="font-semibold text-ink">{t(title)}</p>
            {text && <p className="mt-0.5 text-sm text-ink-2">{t(text)}</p>}
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
  if (moment.isDemo && !viewerIsDemo && demoLabelsVisible) {
    return box("lock", "Moment d'exemple", "Il montre à quoi ressemble un Moment : on ne peut pas le rejoindre.", (
      <Link href="/creer" className="btn-primary w-full">{t("Créer mon Moment")}</Link>
    ));
  }
  if (moment.phase === "draft") return box("lock", "Brouillon", "Ce Moment n'est pas encore publié.");

  if (!signedIn) {
    return (
      <div className="space-y-3">
        <Link href={`/connexion?suite=/moments/${moment.id}`} className="btn-primary w-full">
          {moment.visibility === "PUBLIC" ? t("Rejoindre ce Moment") : t("Demander à rejoindre")}
        </Link>
        <p className="text-center text-sm text-muted">{t("Connecte-toi ou crée un compte en 30 secondes.")}</p>
      </div>
    );
  }

  if (ms?.status === "ACCEPTED") {
    return box(
      "ok",
      "Ta place est confirmée",
      moment.address ? "L'adresse exacte est visible ci-dessous." : "À bientôt sur place !",
      <button type="button" className="btn-ghost w-full text-muted" disabled={!!busy} onClick={() => confirm(t("Libérer ta place ? L'hôte sera prévenu.")) && run("leave", `/api/requests/${ms.id}/cancel`)}>
        {busy === "leave" && <Loader2 size={16} className="animate-spin" />} {t("Je ne peux plus venir")}
      </button>,
    );
  }
  if (ms?.status === "PENDING" && ms.kind === "REQUEST") {
    return box(
      "wait",
      "Demande envoyée",
      "L'hôte te répondra ici et par notification. Aucune relance automatique ne lui est envoyée.",
      <button type="button" className="btn-secondary w-full" disabled={!!busy} onClick={() => run("withdraw", `/api/requests/${ms.id}/cancel`)}>
        {busy === "withdraw" && <Loader2 size={16} className="animate-spin" />} {t("Retirer ma demande")}
      </button>,
    );
  }
  if (ms?.status === "PENDING" && ms.kind === "INVITE") {
    return box(
      "wait",
      t("{name} t'invite", { name: moment.host.name }),
      "Tu es libre d'accepter ou non, l'hôte ne verra qu'un simple « décliné ».",
      <div className="grid grid-cols-2 gap-2">
        <button type="button" className="btn-secondary" disabled={!!busy} onClick={() => run("decline", `/api/requests/${ms.id}/decline`)}>
          {busy === "decline" && <Loader2 size={16} className="animate-spin" />} {t("Décliner")}
        </button>
        <button type="button" className="btn-primary" disabled={!!busy || moment.spotsLeft === 0} onClick={() => run("accept", `/api/requests/${ms.id}/accept`)}>
          {busy === "accept" && <Loader2 size={16} className="animate-spin" />} {t("Accepter")}
        </button>
      </div>,
    );
  }
  if (ms?.status === "DECLINED") {
    return ms.kind === "REQUEST"
      ? box("off", "L'hôte n'a pas pu accepter ta demande", "Ça arrive : le groupe était peut-être déjà constitué. D'autres Moments t'attendent.", <Link href="/" className="btn-secondary w-full">{t("Voir d'autres Moments")}</Link>)
      : box("off", "Tu as décliné cette invitation");
  }
  if (moment.visibility === "INVITE_ONLY") return box("lock", "Sur invitation uniquement", "Seul l'hôte peut inviter des participants.");
  if (moment.spotsLeft === 0) return box("off", "Ce Moment est complet", "Une place peut se libérer : repasse plus tard.");
  if (moment.blackOnly && !viewerIsBlack) {
    return box("lock", "Réservé aux membres Black", "L'hôte a ouvert ce Moment aux membres Upclose Black.", (
      <Link href={`/premium?retour=${encodeURIComponent(`/moments/${moment.id}`)}`} className="btn-primary w-full">{t("Découvrir Upclose Black")}</Link>
    ));
  }

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
          <label htmlFor="join-msg" className="field-label">{t("Un mot pour l'hôte")} <span className="font-normal text-muted">{t("(facultatif)")}</span></label>
          <textarea id="join-msg" className="input min-h-24" maxLength={280} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("Présente-toi en une phrase…")} />
        </div>
      )}
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={showOnMoment} onChange={(e) => setShowOnMoment(e.target.checked)} />
        <span>{t("Apparaître dans la liste des participants visible par les autres")}</span>
      </label>
      <button type="submit" className="btn-primary w-full" disabled={!!busy}>
        {busy === "join" && <Loader2 size={16} className="animate-spin" />}
        {instant ? t("Rejoindre ce Moment") : t("Demander à rejoindre")}
      </button>
      <p className="text-center text-xs text-muted">
        {instant ? t("Accès ouvert : ta place est confirmée tout de suite.") : t("Ta place sera confirmée seulement si l'hôte accepte.")}
      </p>
      {error && <p role="alert" className="field-error text-center">{error}</p>}
    </form>
  );
}

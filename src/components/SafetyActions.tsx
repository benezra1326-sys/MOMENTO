"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Flag, Loader2, ShieldOff } from "lucide-react";
import { api } from "@/lib/client";

const reasons = [
  { id: "spam", label: "Spam ou arnaque" },
  { id: "harassment", label: "Harcèlement ou comportement insistant" },
  { id: "inappropriate", label: "Contenu inapproprié" },
  { id: "safety", label: "Problème de sécurité" },
  { id: "fake", label: "Faux profil ou faux Moment" },
  { id: "other", label: "Autre" },
];

/** Signaler (un Moment ou un profil) et bloquer : toujours accessibles, jamais cachés. */
export function SafetyActions({ username, momentId, blocked = false, label }: { username: string; momentId?: string; blocked?: boolean; label: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<"report" | null>(null);
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function report(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await api("/api/reports", { body: { momentId: momentId ?? null, targetUsername: momentId ? null : username, reason, details } });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error.message });
    setMsg({ ok: true, text: "Merci. Le signalement a été transmis à la modération ; la personne n'est pas prévenue." });
    setOpen(null);
  }

  async function toggleBlock() {
    if (!blocked && !confirm(`Bloquer @${username} ? Vous ne verrez plus vos Moments respectifs et aucune demande ni invitation ne sera possible entre vous.`)) return;
    setBusy(true);
    const res = await api("/api/blocks", { method: blocked ? "DELETE" : "POST", body: { username } });
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: res.error.message });
    if (!blocked) router.push("/");
    else router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !min-h-9 text-sm text-muted" onClick={() => setOpen(open ? null : "report")} aria-expanded={open === "report"}>
          <Flag size={15} /> Signaler {label}
        </button>
        <button type="button" className="btn-ghost !min-h-9 text-sm text-muted" onClick={toggleBlock} disabled={busy}>
          <ShieldOff size={15} /> {blocked ? `Débloquer @${username}` : `Bloquer @${username}`}
        </button>
      </div>
      {open === "report" && (
        <form onSubmit={report} className="space-y-3 rounded-2xl border border-line bg-sand/50 p-4">
          <fieldset>
            <legend className="field-label">Que se passe-t-il ?</legend>
            <div className="space-y-1.5">
              {reasons.map((r) => (
                <label key={r.id} className="flex items-center gap-2.5 text-sm">
                  <input type="radio" name="reason" value={r.id} checked={reason === r.id} onChange={() => setReason(r.id)} className="h-4 w-4 accent-[var(--color-violet)]" />
                  {r.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label htmlFor="report-details" className="field-label">Précisions (facultatif)</label>
          <textarea id="report-details" className="input min-h-20" maxLength={1000} value={details} onChange={(e) => setDetails(e.target.value)} />
          <p className="text-xs text-muted">En cas de danger immédiat, contacte les services d&apos;urgence (112).</p>
          <button type="submit" className="btn-primary" disabled={busy}>{busy && <Loader2 size={16} className="animate-spin" />} Envoyer le signalement</button>
        </form>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
    </div>
  );
}

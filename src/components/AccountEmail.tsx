"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Loader2, MailWarning } from "lucide-react";
import { api } from "@/lib/client";

/** Mot de passe oublié : le message de réponse est le même que l'adresse ait un compte ou non. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (done) {
    return (
      <p role="status" className="rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
        {done} Pense à regarder dans les indésirables.
      </p>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api<{ message: string }>("/api/auth/password/forgot", { body: { email } });
        setBusy(false);
        if (!res.ok) return setError(res.error.message);
        setDone(res.data.message);
      }}
    >
      <div>
        <label htmlFor="forgot-email" className="field-label">Ton adresse e-mail</label>
        <input id="forgot-email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" className="btn-primary w-full !min-h-12" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Recevoir un lien
      </button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!token) {
    return (
      <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">
        Lien incomplet. <Link href="/mot-de-passe-oublie" className="font-semibold underline">Refais une demande</Link>.
      </p>
    );
  }
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (password !== confirm) return setError("Les deux mots de passe ne sont pas identiques.");
        setBusy(true);
        setError(null);
        const res = await api("/api/auth/password/reset", { body: { token, password } });
        setBusy(false);
        if (!res.ok) return setError(res.error.details?.password ?? res.error.message);
        router.push("/?mot-de-passe=modifie");
        router.refresh();
      }}
    >
      <div>
        <label htmlFor="new-password" className="field-label">Nouveau mot de passe</label>
        <input id="new-password" type="password" autoComplete="new-password" minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="field-help">8 caractères minimum.</p>
      </div>
      <div>
        <label htmlFor="confirm-password" className="field-label">Confirme-le</label>
        <input id="confirm-password" type="password" autoComplete="new-password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error} {error.includes("Refais") && <Link href="/mot-de-passe-oublie" className="font-semibold underline">Nouveau lien</Link>}
        </p>
      )}
      <button type="submit" className="btn-primary w-full !min-h-12" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Enregistrer et me connecter
      </button>
    </form>
  );
}

/**
 * Confirmation d'adresse : il faut cliquer sur le bouton. Les antivirus de messagerie ouvrent
 * souvent les liens reçus ; une confirmation automatique à l'ouverture consommerait le jeton.
 */
export function ConfirmEmail({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(token ? null : "Lien incomplet.");
  if (state === "done") {
    return (
      <div className="space-y-4">
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-success-soft px-4 py-3 text-sm text-success">
          <CheckCircle2 size={18} /> Adresse confirmée. Tu peux créer et rejoindre des Moments.
        </p>
        <Link href="/" className="btn-primary w-full">Aller au feed</Link>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
      <button
        type="button"
        className="btn-primary w-full !min-h-12"
        disabled={!token || state === "busy"}
        onClick={async () => {
          setState("busy");
          setError(null);
          const res = await api("/api/auth/verify-email/confirm", { body: { token } });
          if (!res.ok) {
            setState("idle");
            return setError(res.error.message);
          }
          setState("done");
          router.refresh();
        }}
      >
        {state === "busy" && <Loader2 size={16} className="animate-spin" />} Confirmer mon adresse
      </button>
    </div>
  );
}

/** Bandeau pour un compte dont l'adresse n'est pas encore confirmée. */
export function VerifyEmailBanner({ required }: { required: boolean }) {
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-violet/15 bg-violet-soft px-4 py-2 text-center text-sm text-violet">
      <MailWarning size={16} aria-hidden />
      <span>
        {required ? "Confirme ton adresse e-mail pour créer ou rejoindre des Moments." : "Pense à confirmer ton adresse e-mail."}
      </span>
      {state === "sent" ? (
        <span className="font-semibold">Lien envoyé.</span>
      ) : (
        <button
          type="button"
          className="font-semibold underline underline-offset-2"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            setError(null);
            const res = await api("/api/auth/verify-email", { body: {} });
            if (!res.ok) {
              setState("idle");
              return setError(res.error.message);
            }
            setState("sent");
          }}
        >
          Renvoyer le lien
        </button>
      )}
      {error && <span role="alert" className="w-full text-danger">{error}</span>}
    </div>
  );
}

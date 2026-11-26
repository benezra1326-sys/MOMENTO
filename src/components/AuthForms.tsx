"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar } from "./Avatar";

function safeNext(next?: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export function GoogleButton({ next, enabled }: { next?: string | null; enabled: boolean }) {
  if (!enabled) return null;
  return (
    <a href={`/api/auth/google?suite=${encodeURIComponent(safeNext(next))}`} className="btn-secondary w-full !min-h-12">
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
      </svg>
      Continuer avec Google
    </a>
  );
}

export function Divider() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted">
      <span className="h-px flex-1 bg-line" /> ou <span className="h-px flex-1 bg-line" />
    </div>
  );
}

export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api("/api/auth/login", { body: { email, password } });
        setBusy(false);
        if (!res.ok) return setError(res.error.message);
        router.push(safeNext(next));
        router.refresh();
      }}
    >
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="password" className="field-label">Mot de passe</label>
        <input id="password" type="password" autoComplete="current-password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" className="btn-primary w-full !min-h-12" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Se connecter
      </button>
    </form>
  );
}

export function SignupForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const [v, setV] = useState({ name: "", username: "", email: "", password: "", city: "", acceptAge: false });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string | boolean) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => (errors[k] ? <p className="field-error">{errors[k]}</p> : null);
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api("/api/auth/signup", { body: v });
        setBusy(false);
        if (!res.ok) {
          setErrors(res.error.details ?? {});
          return setError(res.error.message);
        }
        router.push(next ? safeNext(next) : "/moi?bienvenue=1");
        router.refresh();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="field-label">Prénom ou nom affiché</label>
          <input id="name" autoComplete="given-name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} />
          {err("name")}
        </div>
        <div>
          <label htmlFor="username" className="field-label">Pseudo</label>
          <input id="username" autoCapitalize="none" className="input" value={v.username} onChange={(e) => set("username", e.target.value.toLowerCase())} placeholder="ex. lea.marbella" />
          {err("username")}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="field-label">Email</label>
        <input id="email" type="email" autoComplete="email" className="input" value={v.email} onChange={(e) => set("email", e.target.value)} />
        {err("email")}
      </div>
      <div>
        <label htmlFor="password" className="field-label">Mot de passe</label>
        <input id="password" type="password" autoComplete="new-password" className="input" value={v.password} onChange={(e) => set("password", e.target.value)} />
        <p className="field-help">8 caractères minimum.</p>
        {err("password")}
      </div>
      <div>
        <label htmlFor="city" className="field-label">Ta ville <span className="font-normal text-muted">(facultatif)</span></label>
        <input id="city" className="input" value={v.city} onChange={(e) => set("city", e.target.value)} placeholder="Marbella" />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-violet)]" checked={v.acceptAge} onChange={(e) => set("acceptAge", e.target.checked)} />
        <span>J&apos;ai 18 ans ou plus et j&apos;accepte de rencontrer les autres membres dans le respect et la sécurité.</span>
      </label>
      {err("acceptAge")}
      {error && <p role="alert" className="field-error">{error}</p>}
      <button type="submit" className="btn-accent w-full !min-h-12" disabled={busy}>
        {busy && <Loader2 size={16} className="animate-spin" />} Créer mon compte
      </button>
    </form>
  );
}

type DemoAccount = { username: string; name: string; photoUrl: string | null; city: string; role: string; _count: { hostedMoments: number } };

export function DemoPicker({ accounts, next }: { accounts: DemoAccount[]; next?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (accounts.length === 0) return null;
  return (
    <section className="card p-5">
      <h2 className="font-semibold">Essayer avec un profil de démo</h2>
      <p className="mt-1 text-sm text-muted">Profils fictifs, sans mot de passe, pour tester les deux côtés : hôte et participant.</p>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2">
        {accounts.map((a) => (
          <li key={a.username}>
            <button
              type="button"
              disabled={!!busy}
              onClick={async () => {
                setBusy(a.username);
                setError(null);
                const res = await api("/api/auth/demo", { body: { username: a.username } });
                setBusy(null);
                if (!res.ok) return setError(res.error.message);
                router.push(safeNext(next));
                router.refresh();
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-line bg-paper p-2.5 text-left hover:border-ink/30 hover:bg-sand/50"
            >
              <Avatar person={a} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{a.name}</span>
                <span className="block truncate text-xs text-muted">
                  {a.role === "ADMIN" ? "Modération" : `${a._count.hostedMoments} Moment${a._count.hostedMoments > 1 ? "s" : ""} · ${a.city}`}
                </span>
              </span>
              {busy === a.username && <Loader2 size={16} className="animate-spin" />}
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="field-error mt-2">{error}</p>}
      <p className="mt-3 text-xs text-muted">
        Astuce : ouvre une fenêtre privée avec un autre profil pour envoyer une demande d&apos;un côté et l&apos;accepter de l&apos;autre.
      </p>
      <p className="sr-only"><Link href="/">Retour</Link></p>
    </section>
  );
}

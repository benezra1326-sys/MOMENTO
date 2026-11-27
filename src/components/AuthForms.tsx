"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar } from "./Avatar";
import { useT } from "./I18nProvider";

function safeNext(next?: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

const socialClass = "btn-secondary w-full !min-h-12";

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function FacebookLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.5c-1.5 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.62 23.1 24 18.1 24 12.07z"
      />
      <path
        fill="#fff"
        d="M16.67 15.56l.53-3.49h-3.33V9.81c0-.96.47-1.89 1.96-1.89h1.5V4.95s-1.37-.24-2.68-.24c-2.74 0-4.54 1.68-4.54 4.7v2.66H7.08v3.49h3.04V24a12.1 12.1 0 003.74 0v-8.44h2.8z"
      />
    </svg>
  );
}

/** Boutons « Continuer avec Google / Facebook ». Chaque bouton n'apparaît que si son fournisseur est configuré. */
export function SocialButtons({
  next,
  google,
  facebook,
  phone = false,
}: {
  next?: string | null;
  google: boolean;
  facebook: boolean;
  phone?: boolean;
}) {
  const t = useT();
  if (!google && !facebook && !phone) return null;
  const suite = encodeURIComponent(safeNext(next));
  return (
    <>
      <div className="space-y-3">
        {google && (
          <a href={`/api/auth/google?suite=${suite}`} className={socialClass}>
            <GoogleLogo />
            {t("Continuer avec Google")}
          </a>
        )}
        {facebook && (
          <a href={`/api/auth/facebook?suite=${suite}`} className={socialClass}>
            <FacebookLogo />
            {t("Continuer avec Facebook")}
          </a>
        )}
        {phone && (
          <Link href={`/connexion/telephone${next ? `?suite=${suite}` : ""}`} className={socialClass}>
            <Smartphone size={20} aria-hidden />
            {t("Continuer avec mon numéro")}
          </Link>
        )}
      </div>
      <Divider />
    </>
  );
}

export function Divider() {
  const t = useT();
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted">
      <span className="h-px flex-1 bg-border" /> {t("ou")}{" "}
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const t = useT();
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
        <label htmlFor="email" className="field-label">
          {t("Email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor="password" className="field-label">
            {t("Mot de passe")}
          </label>
          <Link
            href="/mot-de-passe-oublie"
            className="text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            {t("Mot de passe oublié ?")}
          </Link>
        </div>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn-primary w-full !min-h-12"
        disabled={busy}
      >
        {busy && <Loader2 size={16} className="animate-spin" />}{" "}
        {t("Se connecter")}
      </button>
    </form>
  );
}

export function SignupForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const t = useT();
  const [v, setV] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    city: "",
    acceptAge: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof v, val: string | boolean) =>
    setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) =>
    errors[k] ? <p className="field-error">{errors[k]}</p> : null;
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
          <label htmlFor="name" className="field-label">
            {t("Prénom ou nom affiché")}
          </label>
          <input
            id="name"
            autoComplete="given-name"
            className="input"
            value={v.name}
            onChange={(e) => set("name", e.target.value)}
          />
          {err("name")}
        </div>
        <div>
          <label htmlFor="username" className="field-label">
            {t("Pseudo")}
          </label>
          <input
            id="username"
            autoCapitalize="none"
            className="input"
            value={v.username}
            onChange={(e) => set("username", e.target.value.toLowerCase())}
            placeholder={t("ex. lea.marbella")}
          />
          {err("username")}
        </div>
      </div>
      <div>
        <label htmlFor="email" className="field-label">
          {t("Email")}
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          className="input"
          value={v.email}
          onChange={(e) => set("email", e.target.value)}
        />
        {err("email")}
      </div>
      <div>
        <label htmlFor="password" className="field-label">
          {t("Mot de passe")}
        </label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          className="input"
          value={v.password}
          onChange={(e) => set("password", e.target.value)}
        />
        <p className="field-help">{t("8 caractères minimum.")}</p>
        {err("password")}
      </div>
      <div>
        <label htmlFor="city" className="field-label">
          {t("Ta ville")}{" "}
          <span className="font-normal text-muted">{t("(facultatif)")}</span>
        </label>
        <input
          id="city"
          className="input"
          value={v.city}
          onChange={(e) => set("city", e.target.value)}
          placeholder="Marbella"
        />
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]"
          checked={v.acceptAge}
          onChange={(e) => set("acceptAge", e.target.checked)}
        />
        <span>
          {t(
            "J'ai 18 ans ou plus et j'accepte de rencontrer les autres membres dans le respect et la sécurité.",
          )}
        </span>
      </label>
      {err("acceptAge")}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="btn-primary w-full !min-h-12"
        disabled={busy}
      >
        {busy && <Loader2 size={16} className="animate-spin" />}{" "}
        {t("Créer mon compte")}
      </button>
    </form>
  );
}

type DemoAccount = {
  username: string;
  name: string;
  photoUrl: string | null;
  city: string;
  role: string;
  _count: { hostedMoments: number };
};

export function DemoPicker({
  accounts,
  next,
}: {
  accounts: DemoAccount[];
  next?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT();
  if (accounts.length === 0) return null;
  const groups = [
    {
      title: "Organisateurs",
      list: accounts.filter(
        (a) => a.role !== "ADMIN" && a._count.hostedMoments > 0,
      ),
    },
    {
      title: "Participants (aucun Moment créé)",
      list: accounts.filter(
        (a) => a.role !== "ADMIN" && a._count.hostedMoments === 0,
      ),
    },
    { title: "Modération", list: accounts.filter((a) => a.role === "ADMIN") },
  ];
  return (
    <section className="card p-5">
      <h2 className="font-semibold">{t("Essayer avec un profil de démo")}</h2>
      <p className="mt-1 text-sm text-muted">
        {t(
          "Profils fictifs, sans mot de passe, pour tester les deux côtés : hôte et participant.",
        )}
      </p>
      {groups.map(
        (g) =>
          g.list.length > 0 && (
            <div key={g.title} className="mt-4">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t(g.title)}
              </h3>
              <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                {g.list.map((a) => (
                  <li key={a.username}>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={async () => {
                        setBusy(a.username);
                        setError(null);
                        const res = await api("/api/auth/demo", {
                          body: { username: a.username },
                        });
                        setBusy(null);
                        if (!res.ok) return setError(res.error.message);
                        router.push(safeNext(next));
                        router.refresh();
                      }}
                      className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-2.5 text-left hover:border-ink/30 hover:bg-surface-2/50"
                    >
                      <Avatar person={a} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">
                          {t(a.name)}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {a.role === "ADMIN"
                            ? t("Modération")
                            : a._count.hostedMoments === 0
                              ? `${t("Aucun Moment créé")} · ${a.city}`
                              : `${a._count.hostedMoments} Moment${a._count.hostedMoments > 1 ? "s" : ""} · ${a.city}`}
                        </span>
                      </span>
                      {busy === a.username && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ),
      )}
      {error && (
        <p role="alert" className="field-error mt-2">
          {error}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">
        {t(
          "Astuce : ouvre une fenêtre privée avec un autre profil pour envoyer une demande d'un côté et l'accepter de l'autre.",
        )}
      </p>
      <p className="sr-only">
        <Link href="/">{t("Retour")}</Link>
      </p>
    </section>
  );
}

/** Connexion par SMS : numéro, puis code à 6 chiffres. Un nouveau numéro crée un compte. */
export function PhoneLoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const t = useT();
  const [phone, setPhone] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const lang = typeof document !== "undefined" ? document.documentElement.lang : undefined;
    const res = await api<{ phone: string }>("/api/auth/phone/start", { body: { phone, locale: lang } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setSentTo(res.data.phone);
    setCode("");
  }

  if (!sentTo) {
    return (
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await sendCode();
        }}
      >
        <div>
          <label htmlFor="phone" className="field-label">
            {t("Numéro de téléphone")}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            className="input"
            placeholder="+33 6 12 34 56 78"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <p className="mt-1.5 text-sm text-muted">{t("Tu vas recevoir un code par SMS.")}</p>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full !min-h-12" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} {t("Recevoir le code")}
        </button>
      </form>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await api<{ isNew: boolean }>("/api/auth/phone/verify", { body: { phone: sentTo, code } });
        setBusy(false);
        if (!res.ok) return setError(res.error.message);
        router.push(res.data.isNew ? "/moi?bienvenue=1" : safeNext(next));
        router.refresh();
      }}
    >
      <div>
        <label htmlFor="code" className="field-label">
          {t("Code reçu par SMS")}
        </label>
        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={8}
          className="input text-center text-2xl tracking-[0.4em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          required
          autoFocus
        />
        <p className="mt-1.5 text-sm text-muted">{t("Envoyé au {phone}.", { phone: sentTo })}</p>
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full !min-h-12" disabled={busy || code.length < 4}>
        {busy && <Loader2 size={16} className="animate-spin" />} {t("Se connecter")}
      </button>
      <div className="flex justify-between text-sm">
        <button type="button" className="font-medium text-muted hover:text-ink" onClick={() => setSentTo(null)}>
          {t("Changer de numéro")}
        </button>
        <button type="button" className="font-medium text-muted hover:text-ink" disabled={busy} onClick={() => void sendCode()}>
          {t("Renvoyer le code")}
        </button>
      </div>
    </form>
  );
}

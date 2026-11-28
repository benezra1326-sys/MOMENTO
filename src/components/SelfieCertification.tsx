"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, Clock, Loader2, Lock, RefreshCw, ScanFace, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/client";
import type { VerificationState, Step } from "@/server/verification";
import { Avatar, VerifiedMark } from "./Avatar";
import { useT } from "./I18nProvider";

type Phase = "intro" | "ready" | "recording" | "sending" | "done";
const STEP_MS = 1900;

/**
 * Vérification du profil par vidéo guidée, comme sur les applis de rencontre :
 * on suit des mouvements tirés au hasard (de face, gauche, droite, haut, bas, un geste),
 * la caméra prend une image à chaque mouvement, puis l'IA compare avec la photo de profil.
 * Aucun import depuis la galerie.
 */
export function SelfieCertification({
  me,
  initial,
  retour,
}: {
  me: { name: string; username: string; photoUrl: string | null };
  initial: VerificationState;
  retour?: string;
}) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [phase, setPhase] = useState<Phase>(initial.status === "pending" || initial.verified ? "done" : "intro");
  const [birthDate, setBirthDate] = useState("");
  const [challenge, setChallenge] = useState<{ id: string; steps: Step[] } | null>(null);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const framesRef = useRef<Blob[]>([]);

  const stop = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };
  useEffect(() => stop, []);

  async function begin() {
    setError(null);
    const res = await api<{ id: string; steps: Step[] }>("/api/me/verification", { body: state.hasBirthDate ? {} : { birthDate } });
    if (!res.ok) return setError(res.error.message);
    setChallenge(res.data);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
      streamRef.current = stream;
      setPhase("ready");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Impossible d'ouvrir la caméra. Autorise l'accès à la caméra pour upclose.world dans les réglages de ton navigateur, puis réessaie.");
    }
  }

  function grab(): Promise<Blob | null> {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return Promise.resolve(null);
    const side = Math.min(v.videoWidth, v.videoHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(side, 720);
    canvas.height = canvas.width;
    canvas.getContext("2d")!.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.88));
  }

  async function record() {
    if (!challenge) return;
    setError(null);
    framesRef.current = [];
    setPhase("recording");
    for (let i = 0; i < challenge.steps.length; i++) {
      setCurrent(i);
      await new Promise((r) => setTimeout(r, STEP_MS));
      const b = await grab();
      if (!b) {
        setPhase("ready");
        return setError("La caméra n'a pas encore démarré. Réessaie.");
      }
      framesRef.current.push(b);
    }
    await send();
  }

  async function send() {
    if (!challenge) return;
    setPhase("sending");
    const form = new FormData();
    framesRef.current.forEach((b, i) => form.append(`frame${i}`, new File([b], `frame${i}.jpg`, { type: "image/jpeg" })));
    try {
      const res = await fetch(`/api/me/verification/${challenge.id}`, { method: "POST", body: form, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: VerificationState; error?: { message: string } } | null;
      stop();
      if (!json?.ok || !json.data) {
        setError(json?.error?.message ?? "L'envoi a échoué. Réessaie.");
        setPhase("intro");
        return;
      }
      setState(json.data);
      setPhase(json.data.status === "rejected" ? "intro" : "done");
      router.refresh();
    } catch {
      stop();
      setError("Pas de connexion. Vérifie ton réseau et réessaie.");
      setPhase("intro");
    }
  }

  // ——— Pas de photo de profil ———
  if (!me.photoUrl) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Camera className="mx-auto text-muted" size={36} />
        <h1 className="font-display text-3xl">{t("Ajoute d'abord ta photo")}</h1>
        <p className="text-ink-2">{t("La vérification compare ton visage à ta photo de profil. Ajoute une photo où l'on voit bien ton visage, puis reviens ici.")}</p>
        <Link href="/moi" className="btn-primary w-full">{t("Ajouter ma photo de profil")}</Link>
      </div>
    );
  }

  // ——— Résultat ———
  if (phase === "done") {
    const ok = state.verified;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <span className="relative inline-flex rounded-full bg-surface p-1.5">
          <Avatar person={{ name: me.name, photoUrl: me.photoUrl, verified: ok }} size="xl" />
          {!ok && <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 ring-2 ring-surface"><Clock size={16} className="text-muted" /></span>}
        </span>
        <h1 className="font-display mt-5 text-3xl">{ok ? t("Profil vérifié") : t("Merci, on vérifie")}</h1>
        <p className="mt-2 text-ink-2">
          {ok
            ? t("Le logo Upclose apparaît sur ta photo, partout dans l'appli. Tu peux publier des dispos et rejoindre des Moments.")
            : t("Ta vidéo est examinée par l'équipe. Tu reçois une notification dès que c'est validé, en général dans la journée.")}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          {ok && retour ? <Link href={retour} className="btn-primary w-full">{t("Continuer")}</Link> : null}
          <Link href={`/u/${me.username}`} className={ok && retour ? "btn-secondary w-full" : "btn-primary w-full"}>{t("Voir mon profil")}</Link>
          <Link href="/" className="btn-secondary w-full">{t("Retour au fil")}</Link>
        </div>
      </div>
    );
  }

  // ——— Caméra ———
  if (phase === "ready" || phase === "recording" || phase === "sending") {
    const steps = challenge?.steps ?? [];
    const step = steps[current];
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm text-muted">{t("Vérification du profil")}</p>
          <button type="button" onClick={() => { stop(); setPhase("intro"); }} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label={t("Fermer")}><X size={20} /></button>
        </div>
        <div className="relative mx-auto aspect-[3/4] w-full overflow-hidden rounded-[2rem] bg-black">
          <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          {/* Ovale du visage */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 300 400" preserveAspectRatio="none" aria-hidden>
            <defs>
              <mask id="oval">
                <rect width="300" height="400" fill="white" />
                <ellipse cx="150" cy="185" rx="105" ry="140" fill="black" />
              </mask>
            </defs>
            <rect width="300" height="400" fill="rgba(10,8,20,.55)" mask="url(#oval)" />
            <ellipse cx="150" cy="185" rx="105" ry="140" fill="none" stroke={phase === "recording" ? "#f0477e" : "rgba(255,255,255,.7)"} strokeWidth="3" strokeDasharray={phase === "recording" ? "0" : "8 6"} />
          </svg>
          {phase === "recording" && step && (
            <div key={current} className="absolute inset-x-4 top-4 flex items-center gap-3 rounded-2xl bg-signature px-4 py-3 text-white shadow-lg">
              <span className="text-3xl" aria-hidden>{step.icon}</span>
              <p className="text-lg font-semibold leading-tight">{t(step.label)}</p>
            </div>
          )}
          {phase === "recording" && (
            <div className="absolute inset-x-6 bottom-5 flex gap-1.5" aria-label={t("{i} sur {n}", { i: current + 1, n: steps.length })}>
              {steps.map((s, i) => (
                <span key={s.id} className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                  <span
                    className={`block h-full rounded-full bg-white ${i < current ? "w-full" : i === current ? "animate-[fill_1.9s_linear_forwards]" : "w-0"}`}
                    style={i === current ? { width: 0 } : undefined}
                  />
                </span>
              ))}
            </div>
          )}
          {phase === "sending" && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60 text-white">
              <ScanFace className="animate-pulse" size={44} />
              <span className="font-semibold">{t("L'IA vérifie ton visage…")}</span>
            </span>
          )}
        </div>
        {phase === "ready" && (
          <>
            <p className="mt-4 text-center text-ink-2">{t("Place ton visage dans l'ovale, bien éclairé. Tu vas suivre {n} consignes, environ 12 secondes.", { n: steps.length })}</p>
            <button type="button" className="btn-primary mt-4 min-h-12 w-full" onClick={record}>
              <ShieldCheck size={18} /> {t("Je suis prêt·e")}
            </button>
          </>
        )}
        {error && <p role="alert" className="field-error mt-3">{t(error)}</p>}
      </div>
    );
  }

  // ——— Présentation ———
  const canStart = state.hasBirthDate || /^\d{4}-\d{2}-\d{2}$/.test(birthDate);
  return (
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center text-center">
        <span className="relative inline-flex rounded-full bg-surface p-1.5">
          <Avatar person={{ name: me.name, photoUrl: me.photoUrl }} size="xl" />
          <VerifiedMark px={96} />
        </span>
        <p className="eyebrow mt-5">{t("Gratuit · 20 secondes")}</p>
        <h1 className="font-display mt-1 text-3xl">{t("Vérifie ton profil")}</h1>
        <p className="mt-2 text-ink-2">{t("Sur Upclose, tout le monde est vérifié : c'est obligatoire pour publier une dispo, créer ou rejoindre un Moment. Une courte vidéo de ton visage, et le logo Upclose s'affiche sur ta photo.")}</p>
      </div>
      {state.status === "rejected" && (
        <p className="mt-5 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm">
          {t("Ta dernière vérification n'a pas abouti")}{state.reason ? ` : ${t(state.reason)}` : "."} {t("Tu peux réessayer.")}
        </p>
      )}
      <ol className="mt-6 space-y-3">
        {[
          { n: 1, title: "Filme-toi en direct", text: "La caméra s'ouvre : pas d'import depuis la galerie." },
          { n: 2, title: "Suis les consignes", text: "Tourne la tête à gauche, à droite, en haut, en bas, puis fais un geste. L'ordre change à chaque fois." },
          { n: 3, title: "L'IA compare avec ta photo", text: "Si c'est bien toi, ton profil est vérifié en quelques secondes. Ta vidéo reste privée." },
        ].map((s) => (
          <li key={s.n} className="card flex gap-3 p-4">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-signature text-sm font-bold text-white">{s.n}</span>
            <span>
              <span className="block font-semibold">{t(s.title)}</span>
              <span className="block text-sm text-muted">{t(s.text)}</span>
            </span>
          </li>
        ))}
      </ol>
      {!state.hasBirthDate && (
        <label className="mt-5 block">
          <span className="text-sm font-semibold">{t("Ta date de naissance")}</span>
          <input type="date" className="input mt-1" value={birthDate} max={new Date(Date.now() - 18 * 365.25 * 86400_000).toISOString().slice(0, 10)} onChange={(e) => setBirthDate(e.target.value)} />
          <span className="mt-1 block text-xs text-muted">{t("Upclose est réservé aux 18 ans et plus. Ta date de naissance n'est pas affichée.")}</span>
        </label>
      )}
      {error && <p role="alert" className="field-error mt-4">{t(error)}</p>}
      <button type="button" className="btn-primary mt-6 min-h-12 w-full" onClick={begin} disabled={!canStart}>
        {phase === "intro" && state.status === "rejected" ? <RefreshCw size={18} /> : <Camera size={18} />} {t("Commencer la vérification")}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted"><Lock size={12} /> {t("Si tu changes de photo de profil, on la recompare à ta vidéo.")}</p>
      {phase !== "intro" && <Loader2 className="hidden" />}
    </div>
  );
}

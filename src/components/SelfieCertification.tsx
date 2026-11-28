"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Camera, CheckCircle2, Clock, Loader2, Lock, RefreshCw, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/client";
import type { VerificationState } from "@/server/verification";
import { Avatar, VerifiedMark } from "./Avatar";
import { useT } from "./I18nProvider";

type Gesture = { id: string; label: string; icon: string };
type Step = "intro" | "camera" | "preview" | "sending" | "done";

/**
 * Certification de la photo de profil : selfie pris EN DIRECT avec la caméra, en faisant un geste tiré au hasard.
 * Volontairement, aucun bouton d'import depuis la galerie.
 */
export function SelfieCertification({ me, initial }: { me: { name: string; username: string; photoUrl: string | null }; initial: VerificationState }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [step, setStep] = useState<Step>(initial.status === "pending" || initial.verified ? "done" : "intro");
  const [challenge, setChallenge] = useState<{ id: string; gesture: Gesture } | null>(null);
  const [shot, setShot] = useState<{ blob: Blob; url: string } | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stop = () => {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
  };
  useEffect(() => stop, []);

  async function open() {
    setError(null);
    const res = await api<{ id: string; gesture: Gesture }>("/api/me/verification", { body: {} });
    if (!res.ok) return setError(res.error.message);
    setChallenge(res.data);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1080 } }, audio: false });
      streamRef.current = stream;
      setStep("camera");
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

  function capture() {
    setCount(3);
    let n = 3;
    const timer = setInterval(() => {
      n -= 1;
      if (n > 0) return setCount(n);
      clearInterval(timer);
      setCount(null);
      const v = videoRef.current;
      if (!v || !v.videoWidth) return setError("La caméra n'a pas encore démarré. Réessaie.");
      const side = Math.min(v.videoWidth, v.videoHeight);
      const canvas = document.createElement("canvas");
      canvas.width = Math.min(side, 1080);
      canvas.height = canvas.width;
      const ctx = canvas.getContext("2d")!;
      // On garde l'image telle que la caméra la voit (non inversée) : c'est la vraie photo.
      ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        if (!blob) return setError("La photo n'a pas pu être prise. Réessaie.");
        setShot({ blob, url: URL.createObjectURL(blob) });
        setStep("preview");
      }, "image/jpeg", 0.9);
    }, 800);
  }

  function retake() {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setStep("camera");
    requestAnimationFrame(() => {
      if (videoRef.current && streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        void videoRef.current.play();
      }
    });
  }

  async function send() {
    if (!shot || !challenge) return;
    setStep("sending");
    setError(null);
    const form = new FormData();
    form.append("file", new File([shot.blob], "selfie.jpg", { type: "image/jpeg" }));
    try {
      const res = await fetch(`/api/me/verification/${challenge.id}`, { method: "POST", body: form, credentials: "same-origin" });
      const json = (await res.json().catch(() => null)) as { ok: boolean; data?: VerificationState; error?: { message: string } } | null;
      if (!json?.ok || !json.data) {
        setError(json?.error?.message ?? "L'envoi a échoué. Réessaie.");
        setStep("preview");
        return;
      }
      stop();
      setState(json.data);
      setStep("done");
      router.refresh();
    } catch {
      setError("Pas de connexion. Vérifie ton réseau et réessaie.");
      setStep("preview");
    }
  }

  // ——— Pas de photo de profil ———
  if (!me.photoUrl) {
    return (
      <div className="mx-auto max-w-md space-y-4 text-center">
        <Camera className="mx-auto text-muted" size={36} />
        <h1 className="font-display text-3xl">{t("Ajoute d'abord ta photo")}</h1>
        <p className="text-ink-2">{t("La certification confirme que ta photo de profil, c'est bien toi. Ajoute une photo où l'on voit ton visage, puis reviens ici.")}</p>
        <Link href="/moi#photo" className="btn-primary w-full">{t("Ajouter ma photo de profil")}</Link>
      </div>
    );
  }

  // ——— Résultat ———
  if (step === "done") {
    const ok = state.verified;
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
        <span className="relative inline-flex rounded-full bg-surface p-1.5">
          <Avatar person={{ name: me.name, photoUrl: me.photoUrl, verified: ok }} size="xl" />
          {!ok && <span className="absolute -bottom-1 -right-1 inline-flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 ring-2 ring-surface"><Clock size={16} className="text-muted" /></span>}
        </span>
        <h1 className="font-display mt-5 text-3xl">{ok ? t("Ta photo est certifiée") : t("Merci, on vérifie")}</h1>
        <p className="mt-2 text-ink-2">
          {ok
            ? t("Le logo Upclose apparaît maintenant sur ta photo, partout dans l'appli : les autres savent que c'est vraiment toi.")
            : t("Ton selfie est comparé à ta photo de profil. Tu reçois une notification dès que c'est validé, en général dans la journée.")}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <Link href={`/u/${me.username}`} className="btn-primary w-full">{t("Voir mon profil")}</Link>
          <Link href="/" className="btn-secondary w-full">{t("Retour au fil")}</Link>
        </div>
      </div>
    );
  }

  // ——— Caméra / aperçu ———
  if (step === "camera" || step === "preview" || step === "sending") {
    return (
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-muted">{t("Certification de ta photo")}</p>
          <button type="button" onClick={() => { stop(); setStep("intro"); }} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label={t("Fermer")}><X size={20} /></button>
        </div>
        {challenge && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl bg-signature px-4 py-3 text-white shadow-lg">
            <span className="text-4xl" aria-hidden>{challenge.gesture.icon}</span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">{t("Sur la photo")}</p>
              <p className="text-lg font-semibold leading-tight">{t(challenge.gesture.label)}</p>
            </div>
          </div>
        )}
        <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-[2rem] bg-black">
          {step === "camera" ? (
            <video ref={videoRef} playsInline muted className="h-full w-full -scale-x-100 object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            shot && <img src={shot.url} alt={t("Ton selfie")} className="h-full w-full object-cover" />
          )}
          <span className="pointer-events-none absolute inset-[12%] rounded-full border-2 border-dashed border-white/60" aria-hidden />
          {count !== null && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/30 font-display text-8xl text-white">{count}</span>
          )}
          {step === "sending" && (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/50 text-white">
              <Loader2 className="animate-spin" size={32} /> {t("Vérification…")}
            </span>
          )}
        </div>
        <p className="mt-3 text-center text-sm text-muted">{t("Place ton visage dans le cercle, bien éclairé, sans lunettes de soleil.")}</p>
        {error && <p role="alert" className="field-error mt-3">{t(error)}</p>}
        <div className="mt-5 flex gap-2">
          {step === "camera" ? (
            <button type="button" className="btn-primary min-h-12 w-full" onClick={capture} disabled={count !== null}>
              <Camera size={18} /> {t("Prendre la photo")}
            </button>
          ) : (
            <>
              <button type="button" className="btn-secondary min-h-12 px-5" onClick={retake} disabled={step === "sending"}><RefreshCw size={16} /> {t("Reprendre")}</button>
              <button type="button" className="btn-primary min-h-12 flex-1" onClick={send} disabled={step === "sending"}><ShieldCheck size={18} /> {t("Envoyer pour certification")}</button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ——— Présentation ———
  return (
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center text-center">
        <span className="relative inline-flex rounded-full bg-surface p-1.5">
          <Avatar person={{ name: me.name, photoUrl: me.photoUrl }} size="xl" />
          <VerifiedMark px={96} />
        </span>
        <p className="eyebrow mt-5">{t("Gratuit · 20 secondes")}</p>
        <h1 className="font-display mt-1 text-3xl">{t("Certifie ta photo")}</h1>
        <p className="mt-2 text-ink-2">{t("Prouve que ta photo, c'est vraiment toi. Le logo Upclose s'affiche sur ta photo, partout dans l'appli : on te fait plus facilement confiance pour tes dispos et tes Moments.")}</p>
      </div>
      {state.status === "rejected" && (
        <p className="mt-5 rounded-2xl border border-coral/40 bg-coral/10 px-4 py-3 text-sm">
          {t("Ta dernière demande n'a pas été validée")}{state.reason ? ` : ${t(state.reason)}` : "."} {t("Tu peux réessayer.")}
        </p>
      )}
      <ol className="mt-6 space-y-3">
        {[
          { n: 1, title: "Ouvre la caméra", text: "Le selfie se prend en direct : pas d'import depuis la galerie." },
          { n: 2, title: "Fais le geste demandé", text: "Un geste tiré au hasard (pouce levé, V…) prouve que la photo est prise à l'instant." },
          { n: 3, title: "On compare avec ta photo de profil", text: "Si c'est bien toi, le badge apparaît. Ton selfie reste privé : il n'est jamais montré." },
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
      {error && <p role="alert" className="field-error mt-4">{t(error)}</p>}
      <button type="button" className="btn-primary mt-6 min-h-12 w-full" onClick={open}>
        <Camera size={18} /> {t("Ouvrir la caméra")}
      </button>
      <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted"><Lock size={12} /> {t("Si tu changes de photo de profil, on la recompare à ton selfie.")}</p>
      {state.verified && <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-success"><CheckCircle2 size={16} /> {t("Déjà certifiée")}</p>}
    </div>
  );
}

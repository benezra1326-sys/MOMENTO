"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Camera, Loader2, LogOut, X } from "lucide-react";
import { api } from "@/lib/client";
import { Avatar } from "./Avatar";

type Me = {
  name: string;
  username: string;
  email: string;
  bio: string;
  city: string;
  interests: string[];
  photoUrl: string | null;
  showPastMoments: boolean;
  autoplayVideos: boolean;
  isDemo: boolean;
};

export function ProfileSettings({ me, blocks, welcome }: { me: Me; blocks: { username: string; name: string }[]; welcome: boolean }) {
  const router = useRouter();
  const [v, setV] = useState({ ...me });
  const [interest, setInterest] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Me>(k: K, val: Me[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    const res = await api("/api/me/profile", {
      method: "PATCH",
      body: { name: v.name, bio: v.bio, city: v.city, interests: v.interests, photoUrl: v.photoUrl, showPastMoments: v.showPastMoments, autoplayVideos: v.autoplayVideos },
    });
    setBusy(null);
    if (!res.ok) {
      setErrors(res.error.details ?? {});
      return setMsg({ ok: false, text: res.error.message });
    }
    setErrors({});
    setMsg({ ok: true, text: "Profil enregistré." });
    router.refresh();
  }

  async function upload(file: File) {
    setBusy("photo");
    const fd = new FormData();
    fd.set("file", file);
    fd.set("purpose", "avatar");
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok) set("photoUrl", json.data.url);
      else setMsg({ ok: false, text: json.error.message });
    } catch {
      setMsg({ ok: false, text: "Envoi impossible." });
    }
    setBusy(null);
  }

  return (
    <div className="space-y-6">
      {welcome && (
        <div className="rounded-3xl bg-gradient-to-br from-rose to-violet p-5 text-white">
          <p className="font-display text-2xl">Bienvenue sur Momento !</p>
          <p className="mt-1 text-white/85">Ajoute une photo et quelques mots : les hôtes acceptent plus volontiers un profil complété.</p>
        </div>
      )}

      <form onSubmit={save} className="card space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-xl">Mon profil</h2>
        <div className="flex items-center gap-4">
          <Avatar person={{ name: v.name, photoUrl: v.photoUrl }} size="xl" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>
              {busy === "photo" ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {v.photoUrl ? "Changer la photo" : "Ajouter une photo"}
            </button>
            {v.photoUrl && <button type="button" className="btn-ghost text-muted" onClick={() => set("photoUrl", null)}>Retirer</button>}
          </div>
        </div>
        <p className="field-help -mt-2">Facultatif. La localisation GPS de la photo est supprimée automatiquement.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-name" className="field-label">Nom affiché</label>
            <input id="p-name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={50} />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="p-city" className="field-label">Ville</label>
            <input id="p-city" className="input" value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />
          </div>
        </div>
        <div>
          <label htmlFor="p-bio" className="field-label">Bio</label>
          <textarea id="p-bio" className="input min-h-24" value={v.bio} onChange={(e) => set("bio", e.target.value)} maxLength={300} placeholder="Ce que tu aimes faire, ce que tu cherches…" />
          <p className="field-help">{v.bio.length}/300</p>
        </div>
        <div>
          <label htmlFor="p-int" className="field-label">Centres d&apos;intérêt</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {v.interests.map((i) => (
              <button key={i} type="button" className="pill bg-sand text-ink-soft" onClick={() => set("interests", v.interests.filter((x) => x !== i))} aria-label={`Retirer ${i}`}>
                {i} <X size={12} />
              </button>
            ))}
          </div>
          <input
            id="p-int"
            className="input"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder="Ajoute un intérêt puis Entrée"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const t = interest.trim().toLowerCase();
                if (t.length >= 2 && !v.interests.includes(t) && v.interests.length < 10) set("interests", [...v.interests, t]);
                setInterest("");
              }
            }}
          />
        </div>

        <fieldset className="space-y-3 border-t border-line pt-5">
          <legend className="field-label">Confidentialité et confort</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-violet)]" checked={v.showPastMoments} onChange={(e) => set("showPastMoments", e.target.checked)} />
            <span>Afficher les Moments que j&apos;ai rejoints sur mon profil public</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-violet)]" checked={v.autoplayVideos} onChange={(e) => set("autoplayVideos", e.target.checked)} />
            <span>Lire automatiquement les vidéos du feed (toujours sans son)</span>
          </label>
        </fieldset>

        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
        <button type="submit" className="btn-primary" disabled={!!busy}>
          {busy === "save" && <Loader2 size={16} className="animate-spin" />} Enregistrer
        </button>
      </form>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-display text-xl">Compte</h2>
        <p className="text-sm text-muted">Connecté avec <strong className="text-ink">{me.isDemo ? "un profil de démo" : me.email}</strong> · @{me.username}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            await api("/api/auth/logout", { body: {} });
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut size={16} /> Se déconnecter
        </button>
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-display text-xl">Personnes bloquées</h2>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">Tu n&apos;as bloqué personne. Tu peux bloquer depuis un profil ou un Moment.</p>
        ) : (
          <ul className="divide-y divide-line">
            {blocks.map((b) => (
              <li key={b.username} className="flex items-center justify-between py-2.5">
                <span className="text-sm"><strong>{b.name}</strong> <span className="text-muted">@{b.username}</span></span>
                <button
                  type="button"
                  className="btn-ghost !min-h-9 text-sm"
                  onClick={async () => {
                    await api("/api/blocks", { method: "DELETE", body: { username: b.username } });
                    router.refresh();
                  }}
                >
                  Débloquer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!me.isDemo && (
        <section className="card space-y-3 border-danger/20 p-5 sm:p-6">
          <h2 className="font-display text-xl text-danger">Supprimer mon compte</h2>
          <p className="text-sm text-muted">
            Tes Moments à venir seront annulés (les participants prévenus), tes demandes retirées et tes informations personnelles effacées. C&apos;est définitif.
          </p>
          <label htmlFor="del" className="field-label">Pour confirmer, tape ton pseudo : <span className="font-mono">{me.username}</span></label>
          <input id="del" className="input max-w-xs" value={confirmDelete} onChange={(e) => setConfirmDelete(e.target.value)} autoCapitalize="none" />
          <button
            type="button"
            className="btn-danger"
            disabled={confirmDelete !== me.username || !!busy}
            onClick={async () => {
              setBusy("delete");
              const res = await api("/api/me", { method: "DELETE", body: { confirmUsername: confirmDelete } });
              setBusy(null);
              if (!res.ok) return setMsg({ ok: false, text: res.error.message });
              router.push("/");
              router.refresh();
            }}
          >
            {busy === "delete" && <Loader2 size={16} className="animate-spin" />} Supprimer définitivement
          </button>
        </section>
      )}
    </div>
  );
}

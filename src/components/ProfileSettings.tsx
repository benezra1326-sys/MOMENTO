"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AtSign, Camera, ImagePlus, Loader2, LogOut, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/client";
import { shrinkForUpload } from "@/lib/image-client";
import { Avatar } from "./Avatar";
import { useT } from "./I18nProvider";

type Me = {
  name: string;
  username: string;
  email: string | null;
  phone?: string | null;
  bio: string;
  city: string;
  interests: string[];
  photoUrl: string | null;
  showPastMoments: boolean;
  autoplayVideos: boolean;
  instagram: string | null;
  gallery: string[];
  showAdult: boolean;
  adultConfirmedAt: string | null;
  isDemo: boolean;
};

export function ProfileSettings({ me, blocks, welcome }: { me: Me; blocks: { username: string; name: string }[]; welcome: boolean }) {
  const router = useRouter();
  const t = useT();
  const [v, setV] = useState({ ...me });
  const [interest, setInterest] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [adult, setAdult] = useState({ on: me.showAdult, confirm18: false, rules: false });
  const [adultOpen, setAdultOpen] = useState(false);
  const [adultMsg, setAdultMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const set = <K extends keyof Me>(k: K, val: Me[K]) => setV((p) => ({ ...p, [k]: val }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy("save");
    setMsg(null);
    const res = await api("/api/me/profile", {
      method: "PATCH",
      body: {
        name: v.name,
        bio: v.bio,
        city: v.city,
        interests: v.interests,
        photoUrl: v.photoUrl,
        showPastMoments: v.showPastMoments,
        autoplayVideos: v.autoplayVideos,
        instagram: v.instagram?.trim() ? v.instagram.trim() : null,
        gallery: v.gallery,
      },
    });
    setBusy(null);
    if (!res.ok) {
      setErrors(res.error.details ?? {});
      return setMsg({ ok: false, text: res.error.message });
    }
    setErrors({});
    setMsg({ ok: true, text: t("Profil enregistré.") });
    router.refresh();
  }

  async function upload(file: File, purpose: "avatar" | "cover" = "avatar") {
    setBusy(purpose === "avatar" ? "photo" : "gallery");
    const fd = new FormData();
    fd.set("file", await shrinkForUpload(file));
    fd.set("purpose", purpose);
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) setMsg({ ok: false, text: json.error.message });
      else if (purpose === "avatar") set("photoUrl", json.data.url);
      else setV((p) => ({ ...p, gallery: [...p.gallery, json.data.url].slice(0, 6) }));
    } catch {
      setMsg({ ok: false, text: t("Envoi impossible.") });
    }
    setBusy(null);
  }

  async function saveAdult(enable: boolean) {
    setBusy("adult");
    setAdultMsg(null);
    const res = await api("/api/me/adult", { method: "PATCH", body: { enable, confirm18: adult.confirm18, acceptRules: adult.rules } });
    setBusy(null);
    if (!res.ok) return setAdultMsg({ ok: false, text: res.error.message });
    setAdult((a) => ({ ...a, on: enable }));
    setAdultMsg({ ok: true, text: enable ? t("Espace adulte activé.") : t("Espace adulte désactivé.") });
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {welcome && (
        <div className="rounded-3xl bg-signature p-5 text-white">
          <p className="font-display text-2xl">{t("Bienvenue sur Upclose !")}</p>
          <p className="mt-1 text-white/85">{t("Ajoute une photo et quelques mots : les hôtes acceptent plus volontiers un profil complété.")}</p>
        </div>
      )}

      <form onSubmit={save} className="card space-y-5 p-5 sm:p-6">
        <h2 className="font-display text-xl">{t("Mon profil")}</h2>
        <div className="flex items-center gap-4">
          <Avatar person={{ name: v.name, photoUrl: v.photoUrl }} size="xl" />
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy === "photo"}>
              {busy === "photo" ? <Loader2 size={16} className="animate-spin" /> : <Camera size={16} />} {v.photoUrl ? t("Changer la photo") : t("Ajouter une photo")}
            </button>
            {v.photoUrl && <button type="button" className="btn-ghost text-muted" onClick={() => set("photoUrl", null)}>{t("Retirer")}</button>}
          </div>
        </div>
        <p className="field-help -mt-2">{t("Facultatif. La position GPS est retirée.")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="p-name" className="field-label">{t("Nom affiché")}</label>
            <input id="p-name" className="input" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={50} />
            {errors.name && <p className="field-error">{errors.name}</p>}
          </div>
          <div>
            <label htmlFor="p-city" className="field-label">{t("Ville")}</label>
            <input id="p-city" className="input" value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={60} />
          </div>
        </div>
        <div>
          <label htmlFor="p-bio" className="field-label">{t("Bio")}</label>
          <textarea id="p-bio" className="input min-h-24" value={v.bio} onChange={(e) => set("bio", e.target.value)} maxLength={300} placeholder={t("Ce que tu aimes faire, ce que tu cherches…")} />
          <p className="field-help">{v.bio.length}/300</p>
        </div>
        <div>
          <label htmlFor="p-int" className="field-label">{t("Centres d'intérêt")}</label>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {v.interests.map((i) => (
              <button key={i} type="button" className="pill bg-lilac/10 text-ink-2" onClick={() => set("interests", v.interests.filter((x) => x !== i))} aria-label={t("Retirer {x}", { x: i })}>
                {t(i)} <X size={12} />
              </button>
            ))}
          </div>
          <input
            id="p-int"
            className="input"
            value={interest}
            onChange={(e) => setInterest(e.target.value)}
            placeholder={t("Ajoute un intérêt puis Entrée")}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                const x = interest.trim().toLowerCase();
                if (x.length >= 2 && !v.interests.includes(x) && v.interests.length < 10) set("interests", [...v.interests, x]);
                setInterest("");
              }
            }}
          />
        </div>

        <div>
          <label htmlFor="p-ig" className="field-label">{t("Instagram")}</label>
          <div className="relative">
            <AtSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="p-ig"
              className="input pl-9"
              value={v.instagram ?? ""}
              onChange={(e) => set("instagram", e.target.value)}
              placeholder={t("ton.pseudo")}
              autoCapitalize="none"
              autoCorrect="off"
              maxLength={80}
            />
          </div>
          <p className="field-help">{t("Facultatif. Affiché « non vérifié ».")}</p>
          {errors.instagram && <p className="field-error">{errors.instagram}</p>}
        </div>

        <div>
          <p className="field-label">{t("Mes photos")}</p>
          <p className="field-help -mt-1 mb-2">{t("Jusqu'à 6 photos.")}</p>
          <div className="grid grid-cols-3 gap-2">
            {v.gallery.map((url) => (
              <div key={url} className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"
                  onClick={() => set("gallery", v.gallery.filter((x) => x !== url))}
                  aria-label={t("Retirer")}
                >
                  <X size={14} />
                </button>
              </div>
            ))}
            {v.gallery.length < 6 && (
              <button
                type="button"
                className="grid aspect-[4/5] place-items-center rounded-2xl border border-dashed border-border text-muted"
                onClick={() => galleryRef.current?.click()}
                disabled={busy === "gallery"}
              >
                {busy === "gallery" ? <Loader2 size={20} className="animate-spin" /> : <ImagePlus size={22} />}
              </button>
            )}
          </div>
          <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "cover")} />
          {errors.gallery && <p className="field-error">{errors.gallery}</p>}
        </div>

        <fieldset className="space-y-3 border-t border-border pt-5">
          <legend className="field-label">{t("Confidentialité et confort")}</legend>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={v.showPastMoments} onChange={(e) => set("showPastMoments", e.target.checked)} />
            <span>{t("Afficher les Moments que j'ai rejoints sur mon profil public")}</span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={v.autoplayVideos} onChange={(e) => set("autoplayVideos", e.target.checked)} />
            <span>{t("Lire automatiquement les vidéos du feed (toujours sans son)")}</span>
          </label>
        </fieldset>

        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-success" : "text-danger"}`}>{msg.text}</p>}
        <button type="submit" className="btn-primary" disabled={!!busy}>
          {busy === "save" && <Loader2 size={16} className="animate-spin" />} {t("Enregistrer")}
        </button>
      </form>

      <section id="espace-adulte" className="card scroll-mt-20 space-y-3 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-xl"><ShieldCheck size={20} /> {t("Espace adulte (18+)")}</h2>
        <p className="text-sm text-muted">
          {t("Moments entre adultes, libertins compris. Visible seulement si tu l'actives.")}
        </p>
        {adult.on ? (
          <button type="button" className="btn-secondary" onClick={() => saveAdult(false)} disabled={!!busy}>
            {busy === "adult" && <Loader2 size={16} className="animate-spin" />} {t("Désactiver l'espace adulte")}
          </button>
        ) : !adultOpen ? (
          <button type="button" className="btn-secondary" onClick={() => setAdultOpen(true)}>
            {t("Activer l'espace adulte")}
          </button>
        ) : (
          <>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
              <li>{t("Consentement explicite, à tout moment, et un non est un non.")}</li>
              <li>{t("Respect et bienveillance : aucune pression, aucun jugement.")}</li>
              <li>{t("Discrétion : rien de ce qui est vécu ou partagé ne sort du Moment.")}</li>
              <li>{t("Tout comportement déplacé se signale : la modération intervient.")}</li>
            </ul>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={adult.confirm18} onChange={(e) => setAdult((a) => ({ ...a, confirm18: e.target.checked }))} />
              <span>{t("J'ai 18 ans ou plus.")}</span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={adult.rules} onChange={(e) => setAdult((a) => ({ ...a, rules: e.target.checked }))} />
              <span>{t("J'accepte ces règles.")}</span>
            </label>
            <button type="button" className="btn-secondary" onClick={() => saveAdult(true)} disabled={!!busy || !adult.confirm18 || !adult.rules}>
              {busy === "adult" && <Loader2 size={16} className="animate-spin" />} {t("Activer l'espace adulte")}
            </button>
          </>
        )}
        {adultMsg && <p role="status" className={`text-sm ${adultMsg.ok ? "text-success" : "text-danger"}`}>{adultMsg.text}</p>}
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-display text-xl">{t("Compte")}</h2>
        <p className="text-sm text-muted">{t("Connecté avec")} <strong className="text-ink">{me.isDemo ? t("un profil de démo") : (me.email ?? me.phone)}</strong> · @{me.username}</p>
        <button
          type="button"
          className="btn-secondary"
          onClick={async () => {
            await api("/api/auth/logout", { body: {} });
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut size={16} /> {t("Se déconnecter")}
        </button>
      </section>

      <section className="card space-y-3 p-5 sm:p-6">
        <h2 className="font-display text-xl">{t("Personnes bloquées")}</h2>
        {blocks.length === 0 ? (
          <p className="text-sm text-muted">{t("Tu n'as bloqué personne. Tu peux bloquer depuis un profil ou un Moment.")}</p>
        ) : (
          <ul className="divide-y divide-border">
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
                  {t("Débloquer")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!me.isDemo && (
        <section className="card space-y-3 border-danger/20 p-5 sm:p-6">
          <h2 className="font-display text-xl text-danger">{t("Supprimer mon compte")}</h2>
          <p className="text-sm text-muted">
            {t("Tes Moments à venir seront annulés (les participants prévenus), tes demandes retirées et tes informations personnelles effacées. C'est définitif.")}
          </p>
          <label htmlFor="del" className="field-label">{t("Pour confirmer, tape ton pseudo :")} <span className="font-mono">{me.username}</span></label>
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
            {busy === "delete" && <Loader2 size={16} className="animate-spin" />} {t("Supprimer définitivement")}
          </button>
        </section>
      )}
    </div>
  );
}

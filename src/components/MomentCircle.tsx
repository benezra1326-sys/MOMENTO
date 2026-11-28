"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { Camera, Heart, ImagePlus, Loader2, MessageCircle, Send, Sparkles, Star, Trash2, UserPlus, Video } from "lucide-react";
import { api } from "@/lib/client";
import { shrinkForUpload } from "@/lib/image-client";
import { uploadMomentVideo } from "@/lib/video-client";
import { formatRelative } from "@/lib/time";
import type { MessageDTO } from "@/server/messages";
import type { SouvenirDTO } from "@/server/souvenirs";
import type { RateTarget } from "@/server/ratings";
import type { InviteeSuggestion } from "@/server/matching";
import { Avatar } from "./Avatar";
import { useLocale, useT } from "./I18nProvider";

// ——— Discussion du Moment ———

export function MomentChat({ momentId, closed, pinned }: { momentId: string; closed: boolean; pinned?: React.ReactNode }) {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<MessageDTO[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const last = items?.[items.length - 1]?.createdAt ?? null;

  const load = useCallback(
    async (after: string | null) => {
      const res = await api<MessageDTO[]>(`/api/moments/${momentId}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`);
      if (!res.ok) return;
      setItems((prev) => {
        if (!after || !prev) return res.data;
        const ids = new Set(prev.map((m) => m.id));
        return [...prev, ...res.data.filter((m) => !ids.has(m.id))];
      });
    },
    [momentId],
  );

  useEffect(() => {
    load(null);
  }, [load]);
  useEffect(() => {
    // Rafraîchissement léger tant que la page est ouverte et visible.
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load(last);
    }, 8000);
    return () => clearInterval(id);
  }, [load, last]);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [items?.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    const res = await api<MessageDTO>(`/api/moments/${momentId}/messages`, { body: { body: text } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setText("");
    setItems((p) => [...(p ?? []), res.data]);
  }

  async function remove(id: string) {
    const res = await api(`/api/moments/${momentId}/messages/${id}`, { method: "DELETE" });
    if (res.ok) setItems((p) => (p ?? []).filter((m) => m.id !== id));
  }

  return (
    <section className="card overflow-hidden" aria-labelledby="chat-title">
      <header className="flex items-center gap-2 border-b border-border px-5 py-4">
        <MessageCircle size={18} className="text-accent" aria-hidden />
        <h2 id="chat-title" className="font-display text-xl">{t("La discussion")}</h2>
        <span className="ml-auto text-xs text-muted">{t("Hôte et participants confirmés")}</span>
      </header>
      {pinned && <div className="space-y-2 border-b border-border px-5 py-3">{pinned}</div>}
      <div ref={listRef} className="max-h-[22rem] min-h-[7rem] space-y-3 overflow-y-auto px-5 py-4" aria-live="polite">
        {items === null ? (
          <p className="flex items-center gap-2 text-sm text-muted"><Loader2 size={15} className="animate-spin" aria-hidden /> {t("Chargement…")}</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted">{t("Pas encore de message. Dis bonjour, précise le point de rendez-vous ou un signe pour se reconnaître.")}</p>
        ) : (
          items.map((m) => (
            <div key={m.id} className={`flex items-end gap-2 ${m.mine ? "flex-row-reverse" : ""}`}>
              {!m.mine && <Avatar person={m.author} size="sm" />}
              <div className={`group max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] ${m.mine ? "bg-violet text-white" : "bg-surface-2 text-ink"}`}>
                {!m.mine && <p className="text-xs font-semibold text-accent">{m.author.name.split(" ")[0]}</p>}
                <p className="whitespace-pre-line break-words">{m.body}</p>
                <p className={`mt-0.5 flex items-center gap-2 text-[11px] ${m.mine ? "text-white/70" : "text-muted"}`}>
                  {formatRelative(m.createdAt, locale)}
                  {m.mine && (
                    <button type="button" onClick={() => remove(m.id)} className="underline-offset-2 hover:underline" aria-label={t("Retirer ce message")}>
                      {t("Retirer")}
                    </button>
                  )}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
      {closed ? (
        <p className="border-t border-border px-5 py-3 text-sm text-muted">{t("Ce Moment est annulé : la discussion est fermée.")}</p>
      ) : (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-border p-3">
          <label className="sr-only" htmlFor="chat-input">{t("Ton message")}</label>
          <textarea
            id="chat-input"
            rows={1}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(e as unknown as React.FormEvent);
              }
            }}
            placeholder={t("Écris au groupe…")}
            className="input min-h-11 flex-1 resize-none"
          />
          <button type="submit" className="btn-primary h-11 w-11 shrink-0 !px-0" disabled={busy || !text.trim()} aria-label={t("Envoyer")}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      )}
      {error && <p role="alert" className="field-error px-5 pb-3">{t(error)}</p>}
      <p className="border-t border-border px-5 py-2.5 text-xs text-muted">{t("Ne partage jamais de données bancaires. Un souci ? Signale le profil depuis sa page.")}</p>
    </section>
  );
}

// ——— Souvenirs ———

export function Souvenirs({ momentId, canAdd, initial }: { momentId: string; canAdd: boolean; initial: SouvenirDTO[] }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [media, setMedia] = useState<{ type: "IMAGE" | "VIDEO"; url: string; poster: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function pickImage(file: File) {
    setBusy("upload");
    setError(null);
    const fd = new FormData();
    fd.set("file", await shrinkForUpload(file));
    fd.set("purpose", "cover");
    const res = await fetch("/api/uploads", { method: "POST", body: fd }).then((r) => r.json()).catch(() => null);
    setBusy(null);
    if (!res?.ok) return setError(res?.error?.message ?? t("Envoi impossible. Vérifie ta connexion."));
    setMedia({ type: "IMAGE", url: res.data.url, poster: null });
  }
  async function pickVideo(file: File) {
    setBusy("upload");
    setError(null);
    setProgress(0);
    const res = await uploadMomentVideo(file, t, setProgress);
    setBusy(null);
    if (!res.ok) return setError(res.message);
    setMedia({ type: "VIDEO", url: res.url, poster: res.posterUrl });
  }
  async function submit() {
    setBusy("save");
    setError(null);
    const res = await api(`/api/moments/${momentId}/souvenirs`, {
      body: { body, mediaType: media?.type ?? "TEXT", mediaUrl: media?.url ?? null, posterUrl: media?.poster ?? null },
    });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    setBody("");
    setMedia(null);
    setOpen(false);
    const list = await api<SouvenirDTO[]>(`/api/moments/${momentId}/souvenirs`);
    if (list.ok) setItems(list.data);
    startTransition(() => router.refresh());
  }
  async function remove(id: string) {
    const res = await api(`/api/moments/${momentId}/souvenirs/${id}`, { method: "DELETE" });
    if (res.ok) setItems((p) => p.filter((s) => s.id !== id));
  }

  if (!canAdd && items.length === 0) return null;
  return (
    <section aria-labelledby="souvenirs-title" className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="souvenirs-title" className="flex items-center gap-2 font-display text-xl"><Heart size={19} className="text-coral" aria-hidden /> {t("Souvenirs")}</h2>
          <p className="text-sm text-muted">{t("Ce que le groupe a gardé de ce Moment.")}</p>
        </div>
        {canAdd && !open && (
          <button type="button" className="btn-secondary min-h-10 shrink-0" onClick={() => setOpen(true)}>
            <ImagePlus size={17} /> {t("Partager")}
          </button>
        )}
      </div>

      {open && (
        <div className="card space-y-3 p-4">
          <label className="field-label" htmlFor="souvenir-body">{t("Un mot, un merci, une anecdote")}</label>
          <textarea id="souvenir-body" className="input min-h-20" maxLength={500} value={body} onChange={(e) => setBody(e.target.value)} placeholder={t("Merci pour cette soirée, on remet ça ?")} />
          {media && (
            <div className="relative overflow-hidden rounded-2xl bg-night">
              {media.type === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={media.url} alt="" className="max-h-64 w-full object-cover" />
              ) : (
                <video src={media.url} poster={media.poster ?? undefined} className="max-h-64 w-full" controls playsInline muted />
              )}
              <button type="button" className="pill absolute right-2 top-2 bg-night/80 text-cream" onClick={() => setMedia(null)}>{t("Retirer")}</button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <label className="btn-ghost min-h-10 cursor-pointer">
              <Camera size={17} /> {t("Photo")}
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && pickImage(e.target.files[0])} />
            </label>
            <label className="btn-ghost min-h-10 cursor-pointer">
              <Video size={17} /> {t("Vidéo")}
              <input type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" onChange={(e) => e.target.files?.[0] && pickVideo(e.target.files[0])} />
            </label>
            {busy === "upload" && <span className="text-sm text-muted">{progress > 0 ? `${progress} %` : t("Envoi…")}</span>}
            <div className="ml-auto flex gap-2">
              <button type="button" className="btn-ghost min-h-10" onClick={() => setOpen(false)}>{t("Annuler")}</button>
              <button type="button" className="btn-primary min-h-10" disabled={!!busy || (!media && body.trim().length < 2)} onClick={submit}>
                {busy === "save" ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} {t("Publier")}
              </button>
            </div>
          </div>
          <p className="field-help">{t("Avant de publier une photo de groupe, assure-toi que tout le monde est d'accord.")}</p>
          {error && <p role="alert" className="field-error">{t(error)}</p>}
        </div>
      )}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((s) => (
            <li key={s.id} className={`card relative overflow-hidden ${s.mediaType === "TEXT" ? "col-span-2 p-4 sm:col-span-1" : ""}`}>
              {s.mediaType === "IMAGE" && s.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.mediaUrl} alt={s.body || t("Souvenir de {name}", { name: s.author.name })} className="aspect-square w-full object-cover" loading="lazy" />
              )}
              {s.mediaType === "VIDEO" && s.mediaUrl && <video src={s.mediaUrl} poster={s.posterUrl ?? undefined} className="aspect-square w-full object-cover" controls playsInline muted preload="none" />}
              <div className={s.mediaType === "TEXT" ? "" : "p-3"}>
                {s.body && <p className={`text-ink-2 ${s.mediaType === "TEXT" ? "font-display text-lg leading-snug" : "line-clamp-3 text-sm"}`}>« {s.body} »</p>}
                <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <Avatar person={s.author} size="sm" /> {s.author.name.split(" ")[0]} · {formatRelative(s.createdAt, locale)}
                  {s.canDelete && (
                    <button type="button" onClick={() => remove(s.id)} className="ml-auto text-muted hover:text-danger" aria-label={t("Retirer ce souvenir")}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="card p-4 text-sm text-muted">{t("Le Moment est passé : partage la première photo ou un mot pour le groupe.")}</p>
      )}
    </section>
  );
}

// ——— Notes après le Moment ———

const criteria = [
  { id: "punctuality", label: "Ponctualité", hostOnly: false },
  { id: "ambiance", label: "Ambiance", hostOnly: false },
  { id: "respect", label: "Respect", hostOnly: false },
  { id: "organisation", label: "Organisation", hostOnly: true },
  { id: "accuracy", label: "Fidèle à l'annonce", hostOnly: true },
] as const;

type Draft = { noShow: boolean; comment: string } & Partial<Record<(typeof criteria)[number]["id"], number>>;

function Stars({ value, onChange, label }: { value?: number; onChange: (n: number) => void; label: string }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-ink-2">{t(label)}</span>
      <div role="radiogroup" aria-label={t(label)} className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n}/5`}
            onClick={() => onChange(n)}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface-2"
          >
            <Star size={22} className={value && n <= value ? "fill-warn text-warn" : "text-muted"} />
          </button>
        ))}
      </div>
    </div>
  );
}

export function RateMoment({ momentId }: { momentId: string }) {
  const t = useT();
  const [targets, setTargets] = useState<RateTarget[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api<{ open: boolean; targets: RateTarget[] }>(`/api/moments/${momentId}/ratings`).then((r) => {
      if (r.ok && r.data.open) setTargets(r.data.targets);
      else setTargets([]);
    });
  }, [momentId]);

  const pending = (targets ?? []).filter((p) => !p.alreadyRated);
  if (targets === null || (pending.length === 0 && !done)) return null;

  const set = (id: string, patch: Partial<Draft>) => setDrafts((d) => ({ ...d, [id]: { ...{ noShow: false, comment: "" }, ...d[id], ...patch } }));
  const ready = pending.filter((p) => {
    const d = drafts[p.id];
    return d && (d.noShow || (d.punctuality && d.ambiance && d.respect));
  });

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await api(`/api/moments/${momentId}/ratings`, { body: { ratings: ready.map((p) => ({ userId: p.id, ...drafts[p.id] })) } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setDone(true);
    setTargets((ts) => (ts ?? []).map((p) => (ready.some((r) => r.id === p.id) ? { ...p, alreadyRated: true } : p)));
  }

  if (done && pending.length === 0) {
    return (
      <section className="card flex items-center gap-3 p-5 text-sm">
        <Sparkles size={20} className="shrink-0 text-accent" aria-hidden />
        {t("Merci ! Tes notes sont privées : elles aident à mettre en avant les membres fiables et bienveillants.")}
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby="rate-title">
      <div>
        <h2 id="rate-title" className="flex items-center gap-2 font-display text-xl"><Star size={19} className="text-warn" aria-hidden /> {t("Comment c'était ?")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Tes notes sont privées et anonymes. Personne ne voit qui a noté quoi : seules des moyennes apparaissent, à partir de 3 avis.")}</p>
      </div>
      <ul className="space-y-4">
        {pending.map((p) => {
          const d = drafts[p.id];
          return (
            <li key={p.id} className="space-y-2 rounded-2xl border border-border p-4">
              <div className="flex items-center gap-3">
                <Avatar person={p} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted">{p.isHost ? t("Hôte") : t("Participant·e")}</p>
                </div>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={!!d?.noShow} onChange={(e) => set(p.id, { noShow: e.target.checked })} />
                  {t("Pas venu·e")}
                </label>
              </div>
              {!d?.noShow &&
                criteria
                  .filter((c) => !c.hostOnly || p.isHost)
                  .map((c) => <Stars key={c.id} label={c.label} value={d?.[c.id]} onChange={(n) => set(p.id, { [c.id]: n })} />)}
              <label className="sr-only" htmlFor={`c-${p.id}`}>{t("Commentaire privé")}</label>
              <input id={`c-${p.id}`} className="input" maxLength={500} placeholder={t("Commentaire privé, lu seulement par la modération (facultatif)")} value={d?.comment ?? ""} onChange={(e) => set(p.id, { comment: e.target.value })} />
            </li>
          );
        })}
      </ul>
      {error && <p role="alert" className="field-error">{t(error)}</p>}
      <button type="button" className="btn-primary w-full" disabled={busy || ready.length === 0} onClick={submit}>
        {busy ? <Loader2 size={18} className="animate-spin" /> : <Star size={18} />} {t("Envoyer mes notes")}
      </button>
    </section>
  );
}

// ——— Matching pour l'hôte ———

export function HostMatches({ momentId }: { momentId: string }) {
  const t = useT();
  const router = useRouter();
  const [items, setItems] = useState<InviteeSuggestion[] | null>(null);
  const [sent, setSent] = useState<Record<string, "ok" | string>>({});
  useEffect(() => {
    api<InviteeSuggestion[]>(`/api/moments/${momentId}/suggestions`).then((r) => setItems(r.ok ? r.data : []));
  }, [momentId]);
  if (!items || items.length === 0) return null;

  async function invite(username: string) {
    const res = await api(`/api/moments/${momentId}/invitations`, { body: { username, message: null } });
    setSent((s) => ({ ...s, [username]: res.ok ? "ok" : res.error.message }));
    if (res.ok) startTransition(() => router.refresh());
  }

  return (
    <section className="card space-y-3 p-5" aria-labelledby="matches-title">
      <div>
        <h2 id="matches-title" className="flex items-center gap-2 font-display text-xl"><Sparkles size={19} className="text-accent" aria-hidden /> {t("Ils sont dispo pour ton Moment")}</h2>
        <p className="mt-1 text-sm text-muted">{t("Des membres ont dit être libres à cette heure-là, dans ta ville. Rien n'est envoyé sans toi.")}</p>
      </div>
      <ul className="divide-y divide-border">
        {items.map((s) => (
          <li key={s.availabilityId} className="flex items-center gap-3 py-3">
            <Link href={`/u/${s.person.username}`}><Avatar person={s.person} size="md" /></Link>
            <div className="min-w-0 flex-1">
              <Link href={`/u/${s.person.username}`} className="font-semibold hover:underline">{s.person.name}</Link>
              <p className="truncate text-xs text-muted">{s.reasons.map((r) => t(r)).join(" · ")}</p>
              {s.note && <p className="line-clamp-1 text-sm text-ink-2">« {t(s.note)} »</p>}
            </div>
            {sent[s.person.username] === "ok" ? (
              <span className="pill bg-success-soft text-success">{t("Invité·e")}</span>
            ) : (
              <button type="button" className="btn-secondary min-h-10 shrink-0" onClick={() => invite(s.person.username)}>
                <UserPlus size={16} /> {t("Inviter")}
              </button>
            )}
          </li>
        ))}
      </ul>
      {Object.values(sent).some((v) => v !== "ok") && <p role="alert" className="field-error">{t(Object.values(sent).find((v) => v !== "ok")!)}</p>}
    </section>
  );
}

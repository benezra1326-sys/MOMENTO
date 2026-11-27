"use client";

import { useRouter } from "next/navigation";
import { galleryUrl } from "@/lib/gallery";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, ImagePlus, Loader2, Minus, Plus, Send, Type, Video, X } from "lucide-react";
import { categories, productConfig, vibeSuggestions, visibilityInfo } from "@/config/product";
import { api } from "@/lib/client";
import { shrinkForUpload } from "@/lib/image-client";
import { uploadMomentVideo } from "@/lib/video-client";
import type { MomentCardDTO, PersonSummary } from "@/server/types";
import { Avatar } from "./Avatar";
import { MomentCard } from "./MomentCard";
import { useT } from "./I18nProvider";

export type MomentFormValues = {
  title: string;
  description: string;
  category: string;
  vibeTags: string[];
  mediaType: "IMAGE" | "VIDEO" | "TEXT";
  mediaUrl: string | null;
  posterUrl: string | null;
  textTheme: string | null;
  city: string;
  area: string;
  placeName: string;
  address: string | null;
  addressMembersOnly: boolean;
  startsAtLocal: string;
  endsAtLocal: string;
  timezone: string;
  capacity: number;
  visibility: "PUBLIC" | "REQUEST" | "INVITE_ONLY" | "PRIVATE";
  showAttendees: boolean;
};

/** Personne à inviter quand le Moment est proposé à partir de sa disponibilité. */
export type Invitee = PersonSummary & { slotLabel: string };

const themes = ["dusk", "ocean", "citrus", "plum", "forest", "ink"] as const;

const galleryCovers = [
  "sunset-1", "sunset-2", "dinner-1", "dinner-2", "coffee-1", "coffee-2", "brunch-1", "gallery-1",
  "gallery-2", "walk-1", "walk-2", "sport-1", "sport-2", "party-1", "party-2", "drinks-1", "drinks-2", "boat-1",
];

const ADVANCED_FIELDS = ["endsAtLocal", "address", "vibeTags"];

export function MomentForm({
  mode,
  momentId,
  initial,
  status,
  host,
  invitee,
  quickDates = [],
  memberVideos = true,
  showAdult = false,
}: {
  mode: "create" | "edit";
  momentId?: string;
  initial: MomentFormValues;
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED";
  host: MomentCardDTO["host"];
  invitee?: Invitee | null;
  /** Raccourcis de date (« Ce soir 19 h », « Demain 19 h »…) calculés côté serveur dans le fuseau du lieu. */
  quickDates?: { label: string; value: string }[];
  memberVideos?: boolean;
  /** Catégorie Adulte 18+ proposée seulement aux personnes qui ont activé l'espace adulte. */
  showAdult?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [v, setV] = useState<MomentFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | "upload" | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [inviteOn, setInviteOn] = useState(!!invitee);
  const [inviteMsg, setInviteMsg] = useState(invitee ? t("J'ai vu ta dispo ({slot}) : ça te dit ?", { slot: invitee.slotLabel }) : "");
  const [showPreview, setShowPreview] = useState(false);
  const [advanced, setAdvanced] = useState(
    mode === "edit" && (!!initial.endsAtLocal || !!initial.address || initial.vibeTags.length > 0 || !initial.showAttendees),
  );
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (showPreview && !d.open) d.showModal();
    if (!showPreview && d.open) d.close();
  }, [showPreview]);

  const set = <K extends keyof MomentFormValues>(k: K, val: MomentFormValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k as string];
      return n;
    });
  };

  function addTag(raw: string) {
    const tag = raw.trim().toLowerCase().replace(/^#/, "");
    if (tag.length < 2 || v.vibeTags.includes(tag) || v.vibeTags.length >= 6) return;
    set("vibeTags", [...v.vibeTags, tag]);
    setTagInput("");
  }

  async function uploadPhoto(file: File) {
    setBusy("upload");
    setErrors((e) => ({ ...e, mediaUrl: "" }));
    const fd = new FormData();
    fd.set("file", await shrinkForUpload(file));
    fd.set("purpose", "cover");
    try {
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) setErrors((e) => ({ ...e, mediaUrl: json.error.message }));
      else setV((p) => ({ ...p, mediaType: "IMAGE", mediaUrl: json.data.url, posterUrl: null }));
    } catch {
      setErrors((e) => ({ ...e, mediaUrl: t("Envoi impossible. Vérifie ta connexion.") }));
    }
    setBusy(null);
  }

  async function uploadVideo(file: File) {
    setBusy("upload");
    setProgress(0);
    setErrors((e) => ({ ...e, mediaUrl: "" }));
    const res = await uploadMomentVideo(file, t, setProgress);
    if (!res.ok) setErrors((e) => ({ ...e, mediaUrl: res.message }));
    else setV((p) => ({ ...p, mediaType: "VIDEO", mediaUrl: res.url, posterUrl: res.posterUrl }));
    setBusy(null);
    setProgress(null);
  }

  async function submit(publish: boolean) {
    setBusy(publish ? "publish" : "draft");
    setFormError(null);
    const body = { ...v, endsAtLocal: v.endsAtLocal || null, address: v.address || null, publish };
    const res =
      mode === "create"
        ? await api<{ id: string }>("/api/moments", { body })
        : await api<{ id: string }>(`/api/moments/${momentId}`, { method: "PATCH", body });
    if (!res.ok) {
      setBusy(null);
      const details = res.error.details ?? {};
      setErrors(details);
      if (Object.keys(details).some((k) => ADVANCED_FIELDS.includes(k))) setAdvanced(true);
      setFormError(res.error.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    let suffix = "";
    if (invitee && inviteOn && publish && mode === "create") {
      const inv = await api(`/api/moments/${res.data.id}/invitations`, { body: { username: invitee.username, message: inviteMsg || null } });
      suffix = inv.ok ? "?invitation=envoyee" : "?invitation=echec";
    }
    setBusy(null);
    router.push(`/moments/${res.data.id}${suffix}`);
    router.refresh();
  }

  const preview: MomentCardDTO = {
    id: "apercu",
    title: v.title || t("Titre de ton Moment"),
    description: v.description,
    category: v.category,
    vibeTags: v.vibeTags,
    mediaType: v.mediaType,
    mediaUrl: v.mediaUrl,
    posterUrl: v.posterUrl,
    textTheme: v.textTheme,
    city: v.city || t("Ville"),
    area: v.area,
    placeName: v.placeName,
    startsAt: safeIso(v.startsAtLocal),
    endsAt: null,
    timezone: v.timezone,
    capacity: Number(v.capacity) || 1,
    acceptedCount: 0,
    spotsLeft: Number(v.capacity) || 1,
    status: "PUBLISHED",
    visibility: v.visibility,
    phase: "upcoming",
    isAdult: v.category === "adult",
    isDemo: false,
    host,
    attendeesPreview: [],
    viewerMembership: null,
    isHost: true,
  };

  const err = (k: string) => (errors[k] ? <p className="field-error" id={`${k}-error`}>{errors[k]}</p> : null);
  const isPublished = status === "PUBLISHED";
  const cap = Number(v.capacity) || 1;
  const hasAddress = !!(v.address ?? "").trim();

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
        noValidate
      >
        {formError && (
          <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{formError}</div>
        )}

        {invitee && (
          <section className="card border-accent/40 p-5" aria-label={t("Invitation")}>
            <div className="flex items-center gap-3">
              <Avatar person={invitee} size="md" />
              <div className="min-w-0">
                <p className="font-semibold">{t("Tu proposes un Moment à {name}", { name: invitee.name })}</p>
                <p className="text-sm text-muted">{t("Dispo : {slot}", { slot: invitee.slotLabel })}</p>
              </div>
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={inviteOn} onChange={(e) => setInviteOn(e.target.checked)} />
              <span>
                <strong>{t("L'inviter dès que je publie")}</strong>
                <span className="block text-muted">{t("{name} reçoit une invitation et choisit librement d'accepter ou non.", { name: invitee.name.split(" ")[0] })}</span>
              </span>
            </label>
            {inviteOn && (
              <div className="mt-3">
                <label htmlFor="inviteMsg" className="field-label">{t("Petit mot")} <span className="font-normal text-muted">{t("(facultatif)")}</span></label>
                <input id="inviteMsg" className="input" maxLength={280} value={inviteMsg} onChange={(e) => setInviteMsg(e.target.value)} />
              </div>
            )}
          </section>
        )}

        <Section n={1} title={t("L'idée")}>
          <div>
            <span className="field-label" id="cat-label">{t("Type de Moment")}</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="cat-label">
              {categories.filter((c) => showAdult || c.id !== "adult" || v.category === "adult").map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={v.category === c.id} onClick={() => set("category", c.id)} className={`chip ${v.category === c.id ? "chip-active" : ""}`}>
                  {t(c.label)}
                </button>
              ))}
            </div>
            {err("category")}
          </div>
          <div>
            <label htmlFor="title" className="field-label">{t("Titre")}</label>
            <input id="title" className="input" maxLength={80} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder={t("Ex. : Sunset + verre sur la plage")} aria-invalid={!!errors.title} aria-describedby={errors.title ? "title-error" : undefined} />
            {err("title")}
          </div>
          <div>
            <label htmlFor="description" className="field-label">{t("En deux phrases")}</label>
            <textarea id="description" className="input min-h-28" maxLength={2000} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder={t("Ce qu'on va faire, pour qui c'est, ce qu'il faut apporter…")} aria-invalid={!!errors.description} aria-describedby={errors.description ? "description-error" : "description-help"} />
            <p className="field-help" id="description-help">{v.description.length}/2000</p>
            {err("description")}
          </div>
        </Section>

        <Section n={2} title={t("Quand et où")}>
          <div>
            <label htmlFor="startsAt" className="field-label">{t("Date et heure")}</label>
            {quickDates.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {quickDates.map((q) => (
                  <button key={q.value} type="button" className={`chip !min-h-9 text-sm ${v.startsAtLocal === q.value ? "chip-active" : ""}`} onClick={() => set("startsAtLocal", q.value)}>
                    {q.label}
                  </button>
                ))}
              </div>
            )}
            <input id="startsAt" type="datetime-local" className="input sm:max-w-xs" value={v.startsAtLocal} onChange={(e) => set("startsAtLocal", e.target.value)} aria-invalid={!!errors.startsAtLocal} aria-describedby="startsAt-help" />
            <p className="field-help" id="startsAt-help">{t("Heure locale du lieu ({tz}).", { tz: v.timezone.replace("_", " ") })}</p>
            {err("startsAtLocal")}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="field-label">{t("Ville")}</label>
              <input id="city" list="cities" className="input" value={v.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} />
              <datalist id="cities">{productConfig.cities.map((c) => <option key={c} value={c} />)}</datalist>
              {err("city")}
            </div>
            <div>
              <label htmlFor="area" className="field-label">{t("Quartier ou zone")}</label>
              <input id="area" className="input" value={v.area} onChange={(e) => set("area", e.target.value)} placeholder={t("Ex. : Puerto Banús")} />
            </div>
          </div>
          <div>
            <label htmlFor="placeName" className="field-label">{t("Nom du lieu")} <span className="font-normal text-muted">{t("(visible par tous)")}</span></label>
            <input id="placeName" className="input" value={v.placeName} onChange={(e) => set("placeName", e.target.value)} placeholder={t("Ex. : Rooftop du Golden Mile, ou « Chez moi »")} />
          </div>
        </Section>

        <Section n={3} title={t("Visuel")}>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("Type de visuel")}>
            <button type="button" role="tab" aria-selected={v.mediaType === "IMAGE"} className={`chip ${v.mediaType === "IMAGE" ? "chip-active" : ""}`} onClick={() => setV((p) => ({ ...p, mediaType: "IMAGE", mediaUrl: p.mediaType === "IMAGE" && p.mediaUrl ? p.mediaUrl : galleryUrl(galleryCovers[0]), posterUrl: null }))}><ImagePlus size={15} /> {t("Photo")}</button>
            {memberVideos && (
              <button type="button" role="tab" aria-selected={v.mediaType === "VIDEO"} className={`chip ${v.mediaType === "VIDEO" ? "chip-active" : ""}`} onClick={() => (v.mediaType === "VIDEO" ? null : videoRef.current?.click())}><Video size={15} /> {t("Vidéo")}</button>
            )}
            <button type="button" role="tab" aria-selected={v.mediaType === "TEXT"} className={`chip ${v.mediaType === "TEXT" ? "chip-active" : ""}`} onClick={() => set("mediaType", "TEXT")}><Type size={15} /> {t("Carte texte")}</button>
          </div>
          <input ref={photoRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadPhoto(f); }} />
          <input ref={videoRef} type="file" accept="video/mp4,video/quicktime,video/webm" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) uploadVideo(f); }} />

          {v.mediaType === "TEXT" && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Couleur de la carte")}>
              {themes.map((th) => (
                <button key={th} type="button" role="radio" aria-checked={v.textTheme === th} aria-label={t("Thème {name}", { name: th })} onClick={() => set("textTheme", th)} className={`text-cover-${th} h-12 w-12 rounded-2xl ring-offset-2 ring-offset-surface ${v.textTheme === th ? "ring-2 ring-ink" : ""}`} />
              ))}
            </div>
          )}

          {v.mediaType === "IMAGE" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-secondary" onClick={() => photoRef.current?.click()} disabled={busy === "upload"}>
                  {busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} {t("Importer ma photo")}
                </button>
                <p className="text-xs text-muted">{t("JPEG, PNG ou WebP. La localisation GPS de la photo est supprimée.")}</p>
              </div>
              <p className="text-sm text-muted">{t("Ou choisis une illustration :")}</p>
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {galleryCovers.map((c) => {
                  const url = galleryUrl(c);
                  return (
                    <button key={c} type="button" onClick={() => setV((p) => ({ ...p, mediaType: "IMAGE", mediaUrl: url, posterUrl: null }))} className={`relative aspect-[4/5] overflow-hidden rounded-xl ring-offset-2 ring-offset-surface ${v.mediaUrl === url ? "ring-2 ring-ink" : ""}`} aria-label={t("Choisir l'illustration {name}", { name: c })} aria-pressed={v.mediaUrl === url}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {v.mediaType === "VIDEO" && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn-secondary" onClick={() => videoRef.current?.click()} disabled={busy === "upload"}>
                {busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <Video size={16} />} {v.mediaUrl ? t("Changer de vidéo") : t("Importer ma vidéo")}
              </button>
              <p className="text-xs text-muted">{t("MP4 conseillé, {s} secondes et {mb} Mo maximum. Lue sans le son dans le feed.", { s: productConfig.limits.videoMaxSeconds, mb: Math.round(productConfig.limits.videoMaxBytes / 1024 / 1024) })}</p>
            </div>
          )}
          {busy === "upload" && progress !== null && (
            <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={t("Envoi de la vidéo")}>
              <span className="block h-full rounded-full bg-signature-x transition-[width]" style={{ width: `${progress}%` }} />
            </div>
          )}
          {err("mediaUrl")}
        </Section>

        <Section n={4} title={t("Qui peut venir")}>
          <div>
            <span className="field-label" id="cap-label">{t("Places pour les invités")}</span>
            <div className="flex items-center gap-3" role="group" aria-labelledby="cap-label">
              <button type="button" className="btn-secondary !h-11 !w-11 !min-h-0 !p-0" onClick={() => set("capacity", Math.max(1, cap - 1))} aria-label={t("Une place de moins")} disabled={cap <= 1}><Minus size={18} /></button>
              <input id="capacity" type="number" inputMode="numeric" min={1} max={productConfig.limits.maxCapacity} className="input !w-20 text-center text-lg font-semibold" value={v.capacity} onChange={(e) => set("capacity", Number(e.target.value))} aria-invalid={!!errors.capacity} aria-label={t("Places pour les invités")} />
              <button type="button" className="btn-secondary !h-11 !w-11 !min-h-0 !p-0" onClick={() => set("capacity", Math.min(productConfig.limits.maxCapacity, cap + 1))} aria-label={t("Une place de plus")}><Plus size={18} /></button>
            </div>
            <p className="field-help">{t("Toi non compris. La capacité n'est jamais dépassée.")}</p>
            {err("capacity")}
          </div>
          <fieldset>
            <legend className="field-label">{t("Qui peut voir et rejoindre")}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {productConfig.enabledVisibilities.filter((key) => v.category !== "adult" || key !== "PUBLIC").map((key) => (
                <label key={key} className={`cursor-pointer rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent ${v.visibility === key ? "border-ink bg-surface-2/60" : "border-border bg-surface hover:border-ink/30"}`}>
                  <input type="radio" name="visibility" className="sr-only" checked={v.visibility === key} onChange={() => set("visibility", key)} />
                  <span className="font-semibold">{t(visibilityInfo[key].label)}</span>
                  <span className="mt-1 block text-sm text-muted">{t(visibilityInfo[key].help)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Section>

        <section className="card overflow-hidden">
          <button type="button" className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left sm:px-6" aria-expanded={advanced} aria-controls="advanced" onClick={() => setAdvanced((a) => !a)}>
            <span>
              <span className="font-display text-xl">{t("Plus d'options")}</span>
              <span className="block text-sm text-muted">{t("Heure de fin, adresse exacte, participants visibles, tags d'ambiance")}</span>
            </span>
            <ChevronDown size={20} className={`shrink-0 transition-transform ${advanced ? "rotate-180" : ""}`} aria-hidden />
          </button>
          <div id="advanced" hidden={!advanced} className="space-y-5 border-t border-border px-5 pb-6 pt-5 sm:px-6">
            <div className="sm:max-w-xs">
              <label htmlFor="endsAt" className="field-label">{t("Fin")} <span className="font-normal text-muted">{t("(facultatif)")}</span></label>
              <input id="endsAt" type="datetime-local" className="input" value={v.endsAtLocal} onChange={(e) => set("endsAtLocal", e.target.value)} aria-invalid={!!errors.endsAtLocal} />
              {err("endsAtLocal")}
            </div>
            <div>
              <label htmlFor="address" className="field-label">{t("Adresse exacte")} <span className="font-normal text-muted">{t("(facultatif)")}</span></label>
              <input id="address" className="input" value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder={t("Rue, numéro, étage…")} />
              {hasAddress && (
                <label className="mt-3 flex items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={v.addressMembersOnly} onChange={(e) => set("addressMembersOnly", e.target.checked)} />
                  <span>
                    <strong>{t("Ne révéler l'adresse qu'aux participants confirmés")}</strong>
                    <span className="block text-muted">{t("Recommandé pour un lieu privé. Les autres voient seulement la zone et le nom du lieu, y compris dans les liens partagés.")}</span>
                  </span>
                </label>
              )}
              {err("address")}
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-accent)]" checked={v.showAttendees} onChange={(e) => set("showAttendees", e.target.checked)} />
              <span>{t("Afficher les participants confirmés")} <span className="block text-muted">{t("Chacun peut aussi choisir de ne pas apparaître.")}</span></span>
            </label>
            <div>
              <label htmlFor="tags" className="field-label">{t("Tags d'ambiance")} <span className="font-normal text-muted">{t("(6 max.)")}</span></label>
              <div className="flex flex-wrap gap-1.5">
                {v.vibeTags.map((tag) => (
                  <button key={tag} type="button" onClick={() => set("vibeTags", v.vibeTags.filter((x) => x !== tag))} className="pill bg-lilac/10 text-accent" aria-label={t("Retirer le tag {tag}", { tag })}>
                    #{t(tag)} <X size={12} />
                  </button>
                ))}
              </div>
              <input
                id="tags"
                className="input mt-2"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                placeholder={t("Écris un tag puis Entrée")}
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {vibeSuggestions.filter((s) => !v.vibeTags.includes(s)).slice(0, 8).map((s) => (
                  <button key={s} type="button" className="chip !min-h-8 text-xs" onClick={() => addTag(t(s))}>+ {t(s)}</button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="form-actions sticky bottom-20 z-10 flex gap-2 rounded-3xl border border-border bg-surface/95 p-2.5 shadow-[var(--shadow-lift)] backdrop-blur lg:bottom-4">
          <button type="button" className="btn-secondary !w-12 !min-w-12 !px-0 lg:hidden" onClick={() => setShowPreview(true)} aria-haspopup="dialog" aria-label={t("Aperçu")} title={t("Aperçu")}>
            <Eye size={18} />
          </button>
          {!isPublished && (
            <button type="button" className="btn-secondary !px-4" disabled={!!busy} onClick={() => submit(false)}>
              {busy === "draft" && <Loader2 size={16} className="animate-spin" />} {t("Brouillon")}
            </button>
          )}
          <button type="submit" className="btn-primary min-w-0 flex-1 whitespace-nowrap" disabled={!!busy}>
            {busy === "publish" ? <Loader2 size={16} className="animate-spin" /> : invitee && inviteOn && !isPublished ? <Send size={16} /> : null}
            {isPublished ? t("Enregistrer") : invitee && inviteOn ? t("Publier et inviter") : t("Publier le Moment")}
          </button>
        </div>
      </form>

      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-3">
          <p className="eyebrow">{t("Aperçu dans le feed")}</p>
          <div className="pointer-events-none max-w-sm" aria-hidden inert>
            <MomentCard moment={preview} autoplay={false} />
          </div>
          <PreviewChecks v={v} />
        </div>
      </aside>

      <dialog
        ref={dialogRef}
        onClose={() => setShowPreview(false)}
        onClick={(e) => e.target === dialogRef.current && setShowPreview(false)}
        className="m-auto max-h-[92dvh] w-[min(92vw,24rem)] overflow-y-auto rounded-[2rem] bg-transparent p-0 backdrop:bg-black/70"
        aria-label={t("Aperçu dans le feed")}
      >
        {showPreview && (
          <div className="space-y-3">
            <div className="pointer-events-none" inert>
              <MomentCard moment={preview} autoplay={false} />
            </div>
            <PreviewChecks v={v} />
            <button type="button" className="btn-ink w-full" onClick={() => setShowPreview(false)} autoFocus>{t("Fermer l'aperçu")}</button>
          </div>
        )}
      </dialog>
    </div>
  );
}

/** Ce qui manque encore avant de publier, en clair. */
function PreviewChecks({ v }: { v: MomentFormValues }) {
  const t = useT();
  const items = [
    { ok: v.title.trim().length >= 3, label: t("Un titre") },
    { ok: v.description.trim().length >= 10, label: t("Deux phrases d'ambiance") },
    { ok: !!v.startsAtLocal && new Date(v.startsAtLocal).getTime() > Date.now(), label: t("Une date à venir") },
    { ok: v.city.trim().length >= 2, label: t("Une ville") },
    { ok: v.mediaType === "TEXT" || !!v.mediaUrl, label: t("Un visuel") },
  ];
  return (
    <ul className="card space-y-1.5 p-4 text-sm" aria-label={t("Prêt à publier ?")}>
      {items.map((i) => (
        <li key={i.label} className={`flex items-center gap-2 ${i.ok ? "text-ink-2" : "text-muted"}`}>
          <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${i.ok ? "bg-success-soft text-success" : "bg-surface-2 text-muted"}`} aria-hidden>{i.ok ? "✓" : "·"}</span>
          {i.label}
          <span className="sr-only">{i.ok ? t("fait") : t("à compléter")}</span>
        </li>
      ))}
    </ul>
  );
}

function safeIso(local: string) {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-5 p-5 sm:p-6" aria-labelledby={`s${n}`}>
      <h2 id={`s${n}`} className="flex items-center gap-3 font-display text-xl">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-semibold text-night font-sans">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

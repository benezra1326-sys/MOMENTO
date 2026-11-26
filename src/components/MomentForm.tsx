"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ImagePlus, Loader2, Type, X } from "lucide-react";
import { categories, productConfig, vibeSuggestions, visibilityInfo } from "@/config/product";
import { api } from "@/lib/client";
import { shrinkForUpload } from "@/lib/image-client";
import type { MomentCardDTO } from "@/server/types";
import { MomentCard } from "./MomentCard";

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

const themes = ["dusk", "ocean", "citrus", "plum", "forest", "ink"] as const;

const galleryCovers = [
  "sunset-1", "sunset-2", "dinner-1", "dinner-2", "coffee-1", "coffee-2", "brunch-1", "gallery-1",
  "gallery-2", "walk-1", "walk-2", "sport-1", "sport-2", "party-1", "party-2", "drinks-1", "drinks-2", "boat-1",
];

export function MomentForm({
  mode,
  momentId,
  initial,
  status,
  host,
}: {
  mode: "create" | "edit";
  momentId?: string;
  initial: MomentFormValues;
  status?: "DRAFT" | "PUBLISHED" | "CANCELLED";
  host: MomentCardDTO["host"];
}) {
  const router = useRouter();
  const [v, setV] = useState<MomentFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | "upload" | null>(null);
  const [tagInput, setTagInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MomentFormValues>(k: K, val: MomentFormValues[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => {
      const n = { ...e };
      delete n[k as string];
      return n;
    });
  };

  function addTag(t: string) {
    const tag = t.trim().toLowerCase().replace(/^#/, "");
    if (tag.length < 2 || v.vibeTags.includes(tag) || v.vibeTags.length >= 6) return;
    set("vibeTags", [...v.vibeTags, tag]);
    setTagInput("");
  }

  async function upload(file: File) {
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
      setErrors((e) => ({ ...e, mediaUrl: "Envoi impossible. Vérifie ta connexion." }));
    }
    setBusy(null);
  }

  async function submit(publish: boolean) {
    setBusy(publish ? "publish" : "draft");
    setFormError(null);
    const body = { ...v, endsAtLocal: v.endsAtLocal || null, address: v.address || null, publish };
    const res =
      mode === "create"
        ? await api<{ id: string }>("/api/moments", { body })
        : await api<{ id: string }>(`/api/moments/${momentId}`, { method: "PATCH", body });
    setBusy(null);
    if (!res.ok) {
      setErrors(res.error.details ?? {});
      setFormError(res.error.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    router.push(`/moments/${res.data.id}`);
    router.refresh();
  }

  const preview: MomentCardDTO = {
    id: "apercu",
    title: v.title || "Titre de ton Moment",
    description: v.description,
    category: v.category,
    vibeTags: v.vibeTags,
    mediaType: v.mediaType,
    mediaUrl: v.mediaUrl,
    posterUrl: v.posterUrl,
    textTheme: v.textTheme,
    city: v.city || "Ville",
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
    isDemo: false,
    host,
    attendeesPreview: [],
    viewerMembership: null,
    isHost: true,
  };

  const err = (k: string) => (errors[k] ? <p className="field-error">{errors[k]}</p> : null);
  const isPublished = status === "PUBLISHED";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <form
        className="space-y-8"
        onSubmit={(e) => {
          e.preventDefault();
          submit(true);
        }}
        noValidate
      >
        {formError && (
          <div role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">{formError}</div>
        )}

        <Section n={1} title="L'idée">
          <div>
            <span className="field-label">Type de Moment</span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Catégorie">
              {categories.map((c) => (
                <button key={c.id} type="button" role="radio" aria-checked={v.category === c.id} onClick={() => set("category", c.id)} className={`chip ${v.category === c.id ? "chip-active" : ""}`}>
                  {c.label}
                </button>
              ))}
            </div>
            {err("category")}
          </div>
          <div>
            <label htmlFor="title" className="field-label">Titre</label>
            <input id="title" className="input" maxLength={80} value={v.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex. : Sunset + verre sur la plage" aria-invalid={!!errors.title} />
            {err("title")}
          </div>
          <div>
            <label htmlFor="description" className="field-label">Description et ambiance</label>
            <textarea id="description" className="input min-h-32" maxLength={2000} value={v.description} onChange={(e) => set("description", e.target.value)} placeholder="Ce qu'on va faire, pour qui c'est, ce qu'il faut apporter…" aria-invalid={!!errors.description} />
            <p className="field-help">{v.description.length}/2000</p>
            {err("description")}
          </div>
          <div>
            <label htmlFor="tags" className="field-label">Tags d&apos;ambiance <span className="font-normal text-muted">(6 max.)</span></label>
            <div className="flex flex-wrap gap-1.5">
              {v.vibeTags.map((t) => (
                <button key={t} type="button" onClick={() => set("vibeTags", v.vibeTags.filter((x) => x !== t))} className="pill bg-violet-soft text-violet" aria-label={`Retirer le tag ${t}`}>
                  #{t} <X size={12} />
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
              placeholder="Écris un tag puis Entrée"
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vibeSuggestions.filter((s) => !v.vibeTags.includes(s)).slice(0, 8).map((s) => (
                <button key={s} type="button" className="chip !min-h-8 text-xs" onClick={() => addTag(s)}>+ {s}</button>
              ))}
            </div>
          </div>
        </Section>

        <Section n={2} title="Quand">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="startsAt" className="field-label">Début</label>
              <input id="startsAt" type="datetime-local" className="input" value={v.startsAtLocal} onChange={(e) => set("startsAtLocal", e.target.value)} aria-invalid={!!errors.startsAtLocal} />
              {err("startsAtLocal")}
            </div>
            <div>
              <label htmlFor="endsAt" className="field-label">Fin <span className="font-normal text-muted">(facultatif)</span></label>
              <input id="endsAt" type="datetime-local" className="input" value={v.endsAtLocal} onChange={(e) => set("endsAtLocal", e.target.value)} aria-invalid={!!errors.endsAtLocal} />
              {err("endsAtLocal")}
            </div>
          </div>
          <p className="field-help">Heure locale du lieu ({v.timezone.replace("_", " ")}).</p>
        </Section>

        <Section n={3} title="Où">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="field-label">Ville</label>
              <input id="city" list="cities" className="input" value={v.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} />
              <datalist id="cities">{productConfig.cities.map((c) => <option key={c} value={c} />)}</datalist>
              {err("city")}
            </div>
            <div>
              <label htmlFor="area" className="field-label">Quartier ou zone</label>
              <input id="area" className="input" value={v.area} onChange={(e) => set("area", e.target.value)} placeholder="Ex. : Puerto Banús" />
            </div>
          </div>
          <div>
            <label htmlFor="placeName" className="field-label">Nom du lieu <span className="font-normal text-muted">(visible par tous)</span></label>
            <input id="placeName" className="input" value={v.placeName} onChange={(e) => set("placeName", e.target.value)} placeholder="Ex. : Rooftop du Golden Mile, ou « Chez moi »" />
          </div>
          <div>
            <label htmlFor="address" className="field-label">Adresse exacte <span className="font-normal text-muted">(facultatif)</span></label>
            <input id="address" className="input" value={v.address ?? ""} onChange={(e) => set("address", e.target.value)} placeholder="Rue, numéro, étage…" />
            <label className="mt-3 flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-violet)]" checked={v.addressMembersOnly} onChange={(e) => set("addressMembersOnly", e.target.checked)} />
              <span>
                <strong>Ne révéler l&apos;adresse qu&apos;aux participants confirmés</strong>
                <span className="block text-muted">Recommandé pour un lieu privé. Les autres voient seulement la zone et le nom du lieu, y compris dans les liens partagés.</span>
              </span>
            </label>
          </div>
        </Section>

        <Section n={4} title="Qui et combien">
          <div className="max-w-xs">
            <label htmlFor="capacity" className="field-label">Places pour les invités</label>
            <input id="capacity" type="number" inputMode="numeric" min={1} max={productConfig.limits.maxCapacity} className="input" value={v.capacity} onChange={(e) => set("capacity", Number(e.target.value))} aria-invalid={!!errors.capacity} />
            <p className="field-help">Toi non compris. La capacité n&apos;est jamais dépassée.</p>
            {err("capacity")}
          </div>
          <fieldset>
            <legend className="field-label">Qui peut voir et rejoindre</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {productConfig.enabledVisibilities.map((key) => (
                <label key={key} className={`cursor-pointer rounded-2xl border p-4 transition-colors ${v.visibility === key ? "border-ink bg-sand/60" : "border-line bg-paper hover:border-ink/30"}`}>
                  <input type="radio" name="visibility" className="sr-only" checked={v.visibility === key} onChange={() => set("visibility", key)} />
                  <span className="font-semibold">{visibilityInfo[key].label}</span>
                  <span className="mt-1 block text-sm text-muted">{visibilityInfo[key].help}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--color-violet)]" checked={v.showAttendees} onChange={(e) => set("showAttendees", e.target.checked)} />
            <span>Afficher les participants confirmés <span className="block text-muted">Chacun peut aussi choisir de ne pas apparaître.</span></span>
          </label>
        </Section>

        <Section n={5} title="Visuel">
          <div className="flex flex-wrap gap-2">
            <button type="button" className={`chip ${v.mediaType === "TEXT" ? "chip-active" : ""}`} onClick={() => set("mediaType", "TEXT")}><Type size={15} /> Carte texte</button>
            <button type="button" className={`chip ${v.mediaType === "IMAGE" ? "chip-active" : ""}`} onClick={() => setV((p) => ({ ...p, mediaType: "IMAGE", mediaUrl: p.mediaUrl ?? `/demo/moments/${galleryCovers[0]}.webp` }))}><ImagePlus size={15} /> Image</button>
          </div>
          {v.mediaType === "TEXT" ? (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Couleur de la carte">
              {themes.map((t) => (
                <button key={t} type="button" role="radio" aria-checked={v.textTheme === t} aria-label={`Thème ${t}`} onClick={() => set("textTheme", t)} className={`text-cover-${t} h-12 w-12 rounded-2xl ring-offset-2 ${v.textTheme === t ? "ring-2 ring-ink" : ""}`} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {galleryCovers.map((c) => {
                  const url = `/demo/moments/${c}.webp`;
                  return (
                    <button key={c} type="button" onClick={() => setV((p) => ({ ...p, mediaType: "IMAGE", mediaUrl: url, posterUrl: null }))} className={`relative aspect-[4/5] overflow-hidden rounded-xl ring-offset-2 ${v.mediaUrl === url ? "ring-2 ring-ink" : ""}`} aria-label={`Choisir l'illustration ${c}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <button type="button" className="btn-secondary" onClick={() => fileRef.current?.click()} disabled={busy === "upload"}>
                  {busy === "upload" ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />} Importer ma photo
                </button>
                <p className="text-xs text-muted">JPEG, PNG ou WebP, 8 Mo max. La localisation GPS de la photo est supprimée.</p>
              </div>
            </div>
          )}
          {err("mediaUrl")}
        </Section>

        <div className="sticky bottom-20 z-10 flex flex-wrap gap-2 rounded-3xl border border-line bg-paper/95 p-3 shadow-[var(--shadow-lift)] backdrop-blur lg:bottom-4">
          {!isPublished && (
            <button type="button" className="btn-secondary flex-1" disabled={!!busy} onClick={() => submit(false)}>
              {busy === "draft" && <Loader2 size={16} className="animate-spin" />} Enregistrer le brouillon
            </button>
          )}
          <button type="submit" className="btn-accent flex-1" disabled={!!busy}>
            {busy === "publish" && <Loader2 size={16} className="animate-spin" />}
            {isPublished ? "Enregistrer les modifications" : "Publier le Moment"}
          </button>
        </div>
      </form>

      <aside className="hidden lg:block">
        <div className="sticky top-8 space-y-3">
          <p className="eyebrow">Aperçu dans le feed</p>
          <div className="pointer-events-none max-w-sm" aria-hidden inert>
            <MomentCard moment={preview} autoplay={false} />
          </div>
        </div>
      </aside>
    </div>
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
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-sm font-semibold text-white font-sans">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

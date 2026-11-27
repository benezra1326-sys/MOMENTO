"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarHeart, Eye, EyeOff, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { availabilitySlots, categories, categoryLabel, productConfig } from "@/config/product";
import { api } from "@/lib/client";
import { availabilityWhen } from "@/lib/availability-labels";
import type { AvailabilityDTO } from "@/server/availability";
import { Avatar } from "./Avatar";
import { DemoBadge } from "./DemoBadge";
import { useLocale, useT } from "./I18nProvider";

type Values = { date: string; slot: string; city: string; area: string; categories: string[]; note: string };

/** Carte d'une disponibilité : la personne, le créneau, ses envies, et l'action « Proposer un Moment ». */
export function AvailabilityCard({ a, compact = false }: { a: AvailabilityDTO; compact?: boolean }) {
  const t = useT();
  const locale = useLocale();
  if (compact) {
    return (
      <article className="card flex w-[16.5rem] shrink-0 snap-start flex-col gap-2.5 p-3.5">
        <Link href={`/u/${a.person.username}`} className="flex min-w-0 items-center gap-2.5 rounded-2xl hover:opacity-90">
          <Avatar person={a.person} size="md" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <span className="truncate">{a.person.name}</span>
              {a.isDemo && <DemoBadge />}
            </span>
            <span className="block truncate text-[13px] font-medium text-accent">{availabilityWhen(a, locale, t)}</span>
          </span>
        </Link>
        <p className="truncate text-xs text-muted">
          {[a.area || a.city, ...a.categories.slice(0, 2).map((c) => t(categoryLabel(c)))].join(" · ")}
        </p>
        {!a.isMine && (
          <Link href={`/moments/nouveau?dispo=${a.id}`} className="btn-secondary !min-h-10 w-full text-sm">
            <Sparkles size={15} /> {t("Proposer un Moment")}
          </Link>
        )}
      </article>
    );
  }
  const where = a.area || a.city;
  const envies = a.categories.slice(0, 2).map((c) => t(categoryLabel(c))).join(", ");
  return (
    <article className="card flex flex-col gap-3 p-4">
      <Link href={`/u/${a.person.username}`} className="flex min-w-0 items-center gap-3 rounded-2xl hover:opacity-90">
        <Avatar person={a.person} size="lg" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-semibold">
            <span className="truncate">{a.person.name}</span>
            {a.isDemo && <span className="shrink-0 text-xs font-normal text-muted">· {t("Démo")}</span>}
          </span>
          <span className="block truncate text-sm font-medium text-accent">
            {availabilityWhen(a, locale, t)}{where && ` · ${where}`}
          </span>
          {envies && <span className="block truncate text-sm text-muted">{t("Envie de : {x}", { x: envies })}</span>}
        </span>
      </Link>
      {a.note && <p className="line-clamp-2 text-sm text-ink-2">« {t(a.note)} »</p>}
      <div className="mt-auto pt-1">
        {a.isMine ? (
          <p className="text-xs text-muted">{t("C'est ta dispo")}</p>
        ) : (
          <Link href={`/moments/nouveau?dispo=${a.id}`} className="btn-secondary w-full">
            <Sparkles size={16} /> {t("Lui proposer un Moment")}
          </Link>
        )}
      </div>
    </article>
  );
}

/** Mes disponibilités : publier, modifier, masquer, supprimer. */
type Prefill = { date?: string; slot?: string; city?: string; area?: string; categories?: string[]; note?: string };

export function MyAvailabilities({
  initial,
  defaultCity,
  timezone,
  dates,
  prefill,
  showAdult = false,
}: {
  showAdult?: boolean;
  initial: AvailabilityDTO[];
  defaultCity: string;
  timezone: string;
  dates: { value: string; label: string }[];
  prefill?: Prefill | null;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [editing, setEditing] = useState<string | "new" | null>(prefill ? "new" : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const max = productConfig.limits.availabilitiesActiveMax;

  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(id);
    setError(null);
    const res = await api<AvailabilityDTO>(`/api/availabilities/${id}`, { method: "PATCH", body });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    setItems((p) => p.map((x) => (x.id === id ? res.data : x)));
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm(t("Supprimer cette disponibilité ?"))) return;
    setBusy(id);
    const res = await api(`/api/availabilities/${id}`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return setError(res.error.message);
    setItems((p) => p.filter((x) => x.id !== id));
    router.refresh();
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="mine-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="mine-title" className="font-display text-xl">{t("Tes dispos")}</h2>
          {items.length === 0 && editing !== "new" && <p className="mt-1 max-w-md text-sm text-muted">{t("Dis quand tu es libre : on pourra t'inviter.")}</p>}
        </div>
        {editing !== "new" && items.length < max && (
          <button type="button" className="btn-primary" onClick={() => setEditing("new")}>
            <Plus size={16} /> {t("Je suis dispo")}
          </button>
        )}
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}

      {editing === "new" && (
        <div className="mt-5">
          <AvailabilityEditor
            dates={dates}
            initial={{
              date: prefill?.date && dates.some((d) => d.value === prefill.date) ? prefill.date : dates[0]?.value ?? "",
              slot: prefill?.slot ?? "evening",
              city: prefill?.city || defaultCity,
              area: prefill?.area ?? "",
              categories: prefill?.categories ?? [],
              note: prefill?.note ?? "",
            }}
            timezone={timezone}
            showAdult={showAdult}
            onCancel={() => setEditing(null)}
            onSaved={(a) => {
              setItems((p) => [...p, a].sort((x, y) => x.startsAt.localeCompare(y.startsAt)));
              setEditing(null);
              router.refresh();
            }}
          />
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-5 space-y-3">
          {items.map((a) =>
            editing === a.id ? (
              <li key={a.id}>
                <AvailabilityEditor
                  id={a.id}
                  dates={dates.some((d) => d.value === a.date) ? dates : [{ value: a.date, label: a.date }, ...dates]}
                  initial={{ date: a.date, slot: a.slot, city: a.city, area: a.area, categories: a.categories, note: a.note }}
                  timezone={a.timezone}
                  showAdult={showAdult}
                  onCancel={() => setEditing(null)}
                  onSaved={(n) => {
                    setItems((p) => p.map((x) => (x.id === n.id ? n : x)));
                    setEditing(null);
                    router.refresh();
                  }}
                />
              </li>
            ) : (
              <li key={a.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border border-border p-3 ${a.hidden ? "opacity-60" : ""}`}>
                <CalendarHeart size={20} className="shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{availabilityWhen(a, locale, t)}</p>
                  <p className="truncate text-sm text-muted">
                    {[a.area, a.city].filter(Boolean).join(", ")}
                    {a.categories.length > 0 && ` · ${a.categories.map((c) => t(categoryLabel(c))).join(", ")}`}
                  </p>
                  {a.hidden && <p className="text-xs font-medium text-warn">{t("Masquée : personne ne la voit")}</p>}
                </div>
                <div className="flex gap-1">
                  <IconBtn label={t("Modifier")} onClick={() => setEditing(a.id)} disabled={busy === a.id}><Pencil size={16} /></IconBtn>
                  <IconBtn label={a.hidden ? t("Réafficher") : t("Masquer")} onClick={() => patch(a.id, { hidden: !a.hidden })} disabled={busy === a.id}>
                    {busy === a.id ? <Loader2 size={16} className="animate-spin" /> : a.hidden ? <Eye size={16} /> : <EyeOff size={16} />}
                  </IconBtn>
                  <IconBtn label={t("Supprimer")} onClick={() => remove(a.id)} disabled={busy === a.id}><Trash2 size={16} /></IconBtn>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
      {items.length >= max && <p className="mt-3 text-xs text-muted">{t("{n} dispos à la fois maximum.", { n: max })}</p>}
    </section>
  );
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="inline-flex h-10 w-10 items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:opacity-50">
      {children}
    </button>
  );
}

function AvailabilityEditor({
  id,
  initial,
  dates,
  timezone,
  onCancel,
  onSaved,
  showAdult = false,
}: {
  showAdult?: boolean;
  id?: string;
  initial: Values;
  dates: { value: string; label: string }[];
  timezone: string;
  onCancel: () => void;
  onSaved: (a: AvailabilityDTO) => void;
}) {
  const t = useT();
  const [v, setV] = useState<Values>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof Values>(k: K, val: Values[K]) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };
  const uid = id ?? "new";

  async function save() {
    setBusy(true);
    setError(null);
    const body = { ...v, timezone };
    const res = id
      ? await api<AvailabilityDTO>(`/api/availabilities/${id}`, { method: "PATCH", body })
      : await api<AvailabilityDTO>("/api/availabilities", { body });
    setBusy(false);
    if (!res.ok) {
      setErrors(res.error.details ?? {});
      return setError(res.error.message);
    }
    onSaved(res.data);
  }

  return (
    <form
      className="space-y-4 rounded-2xl border border-accent/40 bg-surface-2/40 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      noValidate
    >
      {error && <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      <div>
        <span className="field-label" id={`${uid}-day`}>{t("Quel jour ?")}</span>
        <div className="scroll-row -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-labelledby={`${uid}-day`}>
          {dates.map((d) => (
            <button key={d.value} type="button" role="radio" aria-checked={v.date === d.value} onClick={() => set("date", d.value)} className={`chip shrink-0 ${v.date === d.value ? "chip-active" : ""}`}>
              {d.label}
            </button>
          ))}
        </div>
        {errors.date && <p className="field-error">{errors.date}</p>}
      </div>
      <div>
        <span className="field-label" id={`${uid}-slot`}>{t("Quand ?")}</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-labelledby={`${uid}-slot`}>
          {availabilitySlots.map((s) => (
            <button key={s.id} type="button" role="radio" aria-checked={v.slot === s.id} onClick={() => set("slot", s.id)} className={`chip ${v.slot === s.id ? "chip-active" : ""}`}>
              {t(s.label)}
            </button>
          ))}
        </div>
        {errors.slot && <p className="field-error">{errors.slot}</p>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-city`} className="field-label">{t("Ville")}</label>
          <input id={`${uid}-city`} list="dispo-cities" className="input" value={v.city} onChange={(e) => set("city", e.target.value)} aria-invalid={!!errors.city} />
          <datalist id="dispo-cities">{productConfig.cities.map((c) => <option key={c} value={c} />)}</datalist>
          {errors.city && <p className="field-error">{errors.city}</p>}
        </div>
        <div>
          <label htmlFor={`${uid}-area`} className="field-label">{t("Quartier")} <span className="font-normal text-muted">{t("(facultatif)")}</span></label>
          <input id={`${uid}-area`} className="input" value={v.area} onChange={(e) => set("area", e.target.value)} placeholder={t("Ex. : Puerto Banús")} />
        </div>
      </div>
      <div>
        <span className="field-label" id={`${uid}-cats`}>{t("Envie de…")} <span className="font-normal text-muted">{t("(4 max., facultatif)")}</span></span>
        <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby={`${uid}-cats`}>
          {categories.filter((c) => c.id !== "other" && (showAdult || c.id !== "adult" || v.categories.includes(c.id))).map((c) => {
            const on = v.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => set("categories", on ? v.categories.filter((x) => x !== c.id) : v.categories.length >= 4 ? v.categories : [...v.categories, c.id])}
                className={`chip !min-h-9 text-sm ${on ? "chip-active" : ""}`}
              >
                {t(c.label)}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-note`} className="field-label">{t("Un mot")} <span className="font-normal text-muted">{t("(facultatif)")}</span></label>
        <input id={`${uid}-note`} className="input" maxLength={200} value={v.note} onChange={(e) => set("note", e.target.value)} placeholder={t("Ex. : Partant·e pour un apéro ou une expo")} />
        <p className="field-help">{t("Ne donne jamais ton adresse ici : seuls la ville et le quartier sont affichés.")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary flex-1" onClick={onCancel} disabled={busy}>{t("Annuler")}</button>
        <button type="submit" className="btn-primary flex-[2]" disabled={busy}>
          {busy && <Loader2 size={16} className="animate-spin" />} {id ? t("Enregistrer") : t("Publier ma dispo")}
        </button>
      </div>
    </form>
  );
}

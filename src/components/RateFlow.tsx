"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Loader2, Lock, MessageSquare, Star, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { api } from "@/lib/client";
import { starWords, tagQuestion, tagsFor } from "@/lib/rating-tags";
import type { PersonSummary } from "@/server/types";
import type { RateTarget } from "@/server/ratings";
import { Avatar } from "./Avatar";
import { useT } from "./I18nProvider";

// ——— Invite « Comment s'est passé ton Moment ? » (fil, Activité, page du Moment) ———

export type RatePromptItem = {
  id: string;
  title: string;
  left: number;
  people: PersonSummary[];
  mediaUrl: string | null;
  textTheme: string | null;
  city?: string;
};

/** Grande carte à étoiles : un appui sur une étoile ouvre l'écran de notation, déjà pré-rempli. */
export function RatePrompt({ item, compact = false }: { item: RatePromptItem; compact?: boolean }) {
  const t = useT();
  const [hover, setHover] = useState(0);
  const names = item.people.map((p) => p.name.split(" ")[0]);
  const who =
    item.left === 1 ? names[0] : item.left === 2 ? `${names[0]} et ${names[1]}` : `${names.slice(0, 2).join(", ")} et ${item.left - 2} autre${item.left - 2 > 1 ? "s" : ""}`;
  return (
    <section className="card relative overflow-hidden border-amber-400/30 p-0" aria-labelledby={`rp-${item.id}`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_100%_0%,rgba(251,191,36,.14),transparent_60%)]" aria-hidden />
      <div className="relative flex items-center gap-3 px-4 pt-4">
        {item.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.mediaUrl} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className={`text-cover-${item.textTheme ?? "dusk"} h-12 w-12 shrink-0 rounded-xl`} aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-300">{t("Moment terminé")}</p>
          <h2 id={`rp-${item.id}`} className="line-clamp-2 font-display text-lg leading-tight">{t("Comment s'est passé « {x} » ?", { x: item.title })}</h2>
        </div>
        <span className="flex -space-x-2">
          {item.people.slice(0, 3).map((p) => <Avatar key={p.id} person={p} size="sm" ring />)}
        </span>
      </div>
      <div className="relative px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-1" onMouseLeave={() => setHover(0)} role="group" aria-label={t("Note de 1 à 5 étoiles")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Link
              key={n}
              href={`/moments/${item.id}/noter?etoiles=${n}`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              aria-label={t("{n} étoile(s) sur 5", { n })}
              className="flex flex-1 items-center justify-center rounded-2xl py-2 transition hover:bg-white/5"
            >
              <Star size={compact ? 30 : 36} strokeWidth={1.6} className={`transition ${n <= hover ? "scale-110 fill-amber-400 text-amber-400" : "text-amber-200/50"}`} />
            </Link>
          ))}
        </div>
        <p className="mt-1 text-center text-sm text-muted">
          {hover ? <span className="font-semibold text-ink">{t(starWords[hover])}</span> : <>{t("Note {who}", { who })}<span className="whitespace-nowrap"> · <Lock size={12} className="inline -mt-0.5" aria-hidden /> {t("anonyme, 30 secondes")}</span></>}
        </p>
      </div>
    </section>
  );
}

// ——— Écran de notation, une personne à la fois ———

type Answer = { stars: number; tags: string[]; again?: boolean; comment: string; noShow: boolean };

export function RateFlow({
  momentId,
  title,
  initialStars,
  cover,
}: {
  momentId: string;
  title: string;
  initialStars?: number;
  cover: { mediaUrl: string | null; textTheme: string | null };
}) {
  const t = useT();
  const router = useRouter();
  const [targets, setTargets] = useState<RateTarget[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [showComment, setShowComment] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState(0);

  useEffect(() => {
    api<{ open: boolean; targets: RateTarget[] }>(`/api/moments/${momentId}/ratings`).then((r) => {
      const list = r.ok && r.data.open ? r.data.targets.filter((p) => !p.alreadyRated) : [];
      // L'hôte d'abord, comme on note d'abord le chauffeur.
      list.sort((a, b) => Number(b.isHost) - Number(a.isHost));
      setTargets(list);
      if (list[0] && initialStars && initialStars >= 1 && initialStars <= 5) {
        setAnswers({ [list[0].id]: { stars: initialStars, tags: [], comment: "", noShow: false } });
      }
    });
  }, [momentId, initialStars]);

  const person = targets?.[index];
  const a: Answer = (person && answers[person.id]) || { stars: 0, tags: [], comment: "", noShow: false };
  const first = person?.name.split(" ")[0] ?? "";
  const chips = useMemo(() => (person && a.stars ? tagsFor(a.stars, person.isHost) : []), [person, a.stars]);

  if (targets === null) {
    return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-muted" /></div>;
  }

  const finished = index >= targets.length;
  if (targets.length === 0 || finished) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center text-center">
        <span className="mb-5 inline-flex h-20 w-20 items-center justify-center rounded-full bg-signature shadow-lg">
          <Check size={40} className="text-white" strokeWidth={2.5} />
        </span>
        <h1 className="font-display text-3xl">{rated > 0 ? t("Merci !") : t("Tout est noté")}</h1>
        <p className="mt-2 text-ink-2">
          {rated > 0
            ? t("Ton avis met en avant les membres sympas et fiables. Il reste anonyme : personne ne sait qui a noté quoi.")
            : t("Tu as déjà noté tout le monde pour ce Moment, ou la période de notation est terminée.")}
        </p>
        <div className="mt-6 flex w-full flex-col gap-2">
          <Link href="/" className="btn-primary w-full">{t("Retour au fil")}</Link>
          <Link href={`/moments/${momentId}`} className="btn-secondary w-full">{t("Voir le Moment et les souvenirs")}</Link>
        </div>
      </div>
    );
  }

  const set = (patch: Partial<Answer>) => setAnswers((all) => ({ ...all, [person!.id]: { ...a, ...patch } }));
  const toggle = (id: string) => set({ tags: a.tags.includes(id) ? a.tags.filter((x) => x !== id) : [...a.tags, id] });
  const setStars = (n: number) => {
    // Changer de camp (bonne / mauvaise note) remet les puces à zéro : elles ne veulent plus rien dire.
    const keep = (n >= 4) === (a.stars >= 4) ? a.tags : [];
    set({ stars: n, tags: keep });
  };
  const next = () => {
    setShowComment(false);
    setError(null);
    setIndex((i) => i + 1);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  async function send(noShow = false) {
    setBusy(true);
    setError(null);
    const body = noShow
      ? { userId: person!.id, noShow: true, comment: a.comment }
      : { userId: person!.id, stars: a.stars, tags: a.tags, again: a.again, comment: a.comment };
    const res = await api(`/api/moments/${momentId}/ratings`, { body: { ratings: [body] } });
    setBusy(false);
    if (!res.ok) return setError(res.error.message);
    setRated((r) => r + 1);
    if (index + 1 >= targets!.length) router.refresh();
    next();
  }

  const q = a.stars ? tagQuestion(a.stars, first) : null;

  return (
    <div className="mx-auto max-w-md pb-24">
      <div className="mb-5 flex items-center gap-3">
        {cover.mediaUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.mediaUrl} alt="" className="h-9 w-9 rounded-lg object-cover" />
        ) : (
          <span className={`text-cover-${cover.textTheme ?? "dusk"} h-9 w-9 rounded-lg`} aria-hidden />
        )}
        <p className="min-w-0 flex-1 truncate text-sm text-muted">{title}</p>
        <Link href={`/moments/${momentId}`} className="rounded-full p-2 text-muted hover:bg-surface-2 hover:text-ink" aria-label={t("Fermer")}>
          <X size={20} />
        </Link>
      </div>

      {targets.length > 1 && (
        <div className="mb-6 flex gap-1.5" aria-label={t("{i} sur {n}", { i: index + 1, n: targets.length })}>
          {targets.map((p, i) => (
            <span key={p.id} className={`h-1 flex-1 rounded-full ${i < index ? "bg-accent" : i === index ? "bg-ink" : "bg-surface-2"}`} />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute -inset-3 rounded-full bg-signature opacity-25 blur-xl" aria-hidden />
          <span className="relative rounded-full bg-surface p-1"><Avatar person={person!} size="xl" /></span>
        </div>
        <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">{person!.isHost ? t("Hôte du Moment") : t("Était là avec toi")}</p>
        <h1 className="font-display text-3xl">{t("Comment était {name} ?", { name: first })}</h1>

        <div className="mt-5 flex gap-1" role="radiogroup" aria-label={t("Note de 1 à 5 étoiles")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={a.stars === n}
              aria-label={t("{n} étoile(s) sur 5", { n })}
              onClick={() => setStars(n)}
              className="rounded-full p-1.5 transition active:scale-90"
            >
              <Star size={44} strokeWidth={1.5} className={`transition ${n <= a.stars ? "scale-105 fill-amber-400 text-amber-400 drop-shadow-[0_2px_8px_rgba(251,191,36,.45)]" : "text-muted/60"}`} />
            </button>
          ))}
        </div>
        <p className="mt-1 h-6 text-base font-semibold text-ink">{a.stars ? t(starWords[a.stars]) : ""}</p>
      </div>

      {a.stars > 0 && q && (
        <div className="mt-6 space-y-6">
          <section>
            <h2 className="font-display text-xl">{t(q.title)}</h2>
            <p className="text-sm text-muted">{t(q.hint)}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {chips.map((c) => {
                const on = a.tags.includes(c.id);
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(c.id)}
                      className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition active:scale-95 ${
                        on
                          ? c.positive
                            ? "border-transparent bg-signature text-white shadow-md"
                            : "border-transparent bg-coral/90 text-white shadow-md"
                          : "border-border bg-surface text-ink-2 hover:border-ink/30"
                      }`}
                    >
                      <span aria-hidden className="text-base">{c.icon}</span> {t(c.label)}
                      {on && <Check size={15} aria-hidden />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl">{t("Tu referais un Moment avec {name} ?", { name: first })}</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                aria-pressed={a.again === true}
                onClick={() => set({ again: a.again === true ? undefined : true })}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${a.again === true ? "border-transparent bg-success text-white" : "border-border bg-surface text-ink-2"}`}
              >
                <ThumbsUp size={18} /> {t("Oui, avec plaisir")}
              </button>
              <button
                type="button"
                aria-pressed={a.again === false}
                onClick={() => set({ again: a.again === false ? undefined : false })}
                className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold transition ${a.again === false ? "border-transparent bg-ink text-surface" : "border-border bg-surface text-ink-2"}`}
              >
                <ThumbsDown size={18} /> {t("Pas vraiment")}
              </button>
            </div>
          </section>

          <section>
            {showComment || a.comment ? (
              <>
                <label htmlFor="rate-comment" className="font-display text-xl">{t("Un mot en plus ?")}</label>
                <textarea
                  id="rate-comment"
                  className="input mt-2 min-h-24"
                  maxLength={500}
                  autoFocus
                  placeholder={t("Facultatif. Lu seulement par l'équipe Upclose, jamais affiché sur le profil.")}
                  value={a.comment}
                  onChange={(e) => set({ comment: e.target.value })}
                />
              </>
            ) : (
              <button type="button" onClick={() => setShowComment(true)} className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
                <MessageSquare size={16} /> {t("Ajouter un commentaire (facultatif)")}
              </button>
            )}
          </section>
        </div>
      )}

      {error && <p role="alert" className="field-error mt-4">{t(error)}</p>}

      <div className="mt-8 flex flex-col items-center gap-3">
        <button type="button" onClick={() => send(true)} disabled={busy} className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
          {t("{name} n'est pas venu·e", { name: first })}
        </button>
        <p className="flex items-center gap-1.5 text-xs text-muted"><Lock size={12} aria-hidden /> {t("Anonyme : {name} ne saura jamais ce que tu as répondu.", { name: first })}</p>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:left-64">
        <div className="mx-auto flex max-w-md gap-2">
          <button type="button" className="btn-secondary min-h-12 px-5" onClick={next} disabled={busy}>
            {t("Passer")}
          </button>
          <button type="button" className="btn-primary min-h-12 flex-1" disabled={busy || !a.stars} onClick={() => send(false)}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : null}
            {index + 1 < targets.length ? <>{t("Suivant")} <ChevronRight size={18} /></> : t("Envoyer")}
          </button>
        </div>
      </div>
    </div>
  );
}

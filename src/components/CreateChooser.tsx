"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CalendarHeart, Loader2, Sparkles, Wand2 } from "lucide-react";
import { api } from "@/lib/client";
import { useT } from "./I18nProvider";

type Draft = {
  kind: "moment" | "availability";
  title: string;
  description: string;
  category: string;
  city: string;
  area: string;
  date: string | null;
  time: string | null;
  slot: string | null;
  capacity: number | null;
  vibeTags: string[];
  note: string;
  engine: "claude" | "rules";
};

const examples = [
  "Apéro sunset samedi vers 19 h à Puerto Banús, 4 personnes",
  "Je suis libre demain soir, envie d'un resto ou d'un concert",
  "Padel dimanche matin, il me manque 2 joueurs",
];

/** Créer : deux portes (proposer un Moment ou dire qu'on est dispo) et l'assistant qui transforme une phrase en brouillon. */
export function CreateChooser({ availability }: { availability: boolean }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [kind, setKind] = useState<"auto" | "moment" | "availability">("auto");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<Draft>("/api/ai/draft", { body: { text, kind: availability ? kind : "moment" } });
    if (!res.ok) {
      setBusy(false);
      return setError(res.error.message);
    }
    const d = res.data;
    const p = new URLSearchParams();
    if (d.kind === "availability" && availability) {
      p.set("nouveau", "1");
      if (d.date) p.set("date", d.date);
      if (d.slot) p.set("slot", d.slot);
      if (d.city) p.set("ville", d.city);
      if (d.area) p.set("area", d.area);
      if (d.category) p.set("cat", d.category);
      if (d.note) p.set("note", d.note);
      router.push(`/dispos?${p}`);
    } else {
      if (d.title) p.set("titre", d.title);
      if (d.description) p.set("description", d.description);
      if (d.category) p.set("cat", d.category);
      if (d.city) p.set("ville", d.city);
      if (d.area) p.set("quartier", d.area);
      if (d.date) p.set("date", d.date);
      if (d.time) p.set("heure", d.time);
      if (d.capacity) p.set("places", String(d.capacity));
      if (d.vibeTags.length) p.set("vibes", d.vibeTags.join(","));
      router.push(`/moments/nouveau?${p}`);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <form onSubmit={prepare} className="card space-y-3 p-5 sm:p-6">
        <label htmlFor="ai-text" className="flex items-center gap-2 font-display text-xl">
          <Sparkles size={20} className="text-accent" /> {t("Dis-le en une phrase")}
        </label>
        <p className="text-sm text-muted">{t("L'assistant prépare le brouillon : titre, jour, heure, lieu, places. Tu relis et tu ajoutes une photo, une vidéo ou juste du texte.")}</p>
        <textarea
          id="ai-text"
          className="input min-h-24"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          placeholder={t(examples[0])}
        />
        <div className="scroll-row -mx-1 flex gap-2 overflow-x-auto px-1">
          {examples.map((x) => (
            <button key={x} type="button" className="chip shrink-0 text-left" onClick={() => setText(t(x))}>{t(x)}</button>
          ))}
        </div>
        {availability && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("Type")}>
            {(["auto", "moment", "availability"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} className={`chip ${kind === k ? "chip-active" : ""}`} onClick={() => setKind(k)}>
                {t(k === "auto" ? "L'IA devine" : k === "moment" ? "Je propose" : "Je suis dispo")}
              </button>
            ))}
          </div>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy || text.trim().length < 4}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {t("Préparer mon brouillon")}
        </button>
      </form>

      <p className="text-center text-sm text-muted">{t("ou choisis directement")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/moments/nouveau" className="card group relative overflow-hidden p-5 transition-colors hover:border-ink/30">
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-coral/30 blur-2xl" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-signature text-white"><Sparkles size={22} /></span>
          <h2 className="relative mt-4 font-display text-2xl">{t("Je propose un moment")}</h2>
          <p className="relative mt-1 text-sm text-muted">{t("Un apéro, un dîner, une sortie : tu fixes le lieu, l'heure et les places. Les gens demandent à venir.")}</p>
        </Link>
        {availability && (
          <Link href="/dispos?nouveau=1" className="card group relative overflow-hidden p-5 transition-colors hover:border-ink/30">
            <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/30 blur-2xl" />
            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac/20 text-accent"><CalendarHeart size={22} /></span>
            <h2 className="relative mt-4 font-display text-2xl">{t("Je suis dispo / j'ai envie de…")}</h2>
            <p className="relative mt-1 text-sm text-muted">{t("Dis quand tu es libre et ce qui te tente : quelqu'un pourra t'inviter. Rien n'est envoyé sans ton accord.")}</p>
          </Link>
        )}
      </div>
    </div>
  );
}

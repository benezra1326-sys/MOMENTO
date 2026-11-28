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
  { label: "Apéro samedi 19 h", text: "Apéro sunset samedi vers 19 h à Puerto Banús, 4 personnes" },
  { label: "Libre demain soir", text: "Je suis libre demain soir, envie d'un resto ou d'un concert" },
  { label: "Padel dimanche", text: "Padel dimanche matin, il me manque 2 joueurs" },
];

/** Créer : deux portes (proposer un Moment ou dire qu'on est dispo) et l'assistant qui transforme une phrase en brouillon. */
export function CreateChooser({ availability }: { availability: boolean }) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [premiumNeeded, setPremiumNeeded] = useState(false);

  async function prepare(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await api<Draft>("/api/ai/draft", { body: { text, kind: availability ? "auto" : "moment" } });
    if (!res.ok) {
      setBusy(false);
      setPremiumNeeded(res.error.code === "PREMIUM_REQUIRED");
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
        <textarea
          id="ai-text"
          className="input min-h-24"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          placeholder={t(examples[0].text)}
        />
        <div className="flex flex-wrap gap-2">
          {examples.filter((x) => availability || !x.label.startsWith("Libre")).map((x) => (
            <button key={x.label} type="button" className="chip" onClick={() => setText(t(x.text))}>{t(x.label)}</button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error} {premiumNeeded && <Link href="/premium" className="font-semibold underline">{t("Voir Upclose+")}</Link>}
          </p>
        )}
        <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy || text.trim().length < 4}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />} {t("Préparer mon brouillon")}
        </button>
      </form>

      <p className="text-center text-sm text-muted">{t("ou choisis directement")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/moments/nouveau" className="card group relative overflow-hidden p-5 transition-colors hover:border-ink/30">
          <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-coral/30 blur-2xl" />
          <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-signature text-white"><Sparkles size={22} /></span>
          <h2 className="relative mt-4 font-display text-2xl">{t("Je propose un Moment")}</h2>
          <p className="relative mt-1 text-sm text-muted">{t("Un lieu, une heure, des places.")}</p>
        </Link>
        {availability && (
          <Link href="/dispos?nouveau=1" className="card group relative overflow-hidden p-5 transition-colors hover:border-ink/30">
            <span className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-accent/30 blur-2xl" />
            <span className="relative inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-lilac/20 text-accent"><CalendarHeart size={22} /></span>
            <h2 className="relative mt-4 font-display text-2xl">{t("Je suis dispo")}</h2>
            <p className="relative mt-1 text-sm text-muted">{t("Dis quand tu es libre, on t'invite.")}</p>
          </Link>
        )}
      </div>
    </div>
  );
}

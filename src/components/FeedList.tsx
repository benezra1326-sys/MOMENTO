"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import type { FeedPage, MomentCardDTO } from "@/server/types";
import { api } from "@/lib/client";
import { MomentCard } from "./MomentCard";
import { useT } from "./I18nProvider";

export function FeedList({ initial, query, autoplay, signedIn }: { initial: FeedPage; query: string; autoplay: boolean; signedIn: boolean }) {
  const [items, setItems] = useState<MomentCardDTO[]>(initial.items);
  const [cursor, setCursor] = useState<string | null>(initial.nextCursor);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT();

  async function more() {
    if (!cursor) return;
    setLoading(true);
    setError(null);
    const p = new URLSearchParams(query);
    p.set("cursor", cursor);
    const res = await api<FeedPage>(`/api/moments?${p}`);
    setLoading(false);
    if (!res.ok) return setError(res.error.message);
    setItems((prev) => [...prev, ...res.data.items.filter((n) => !prev.some((o) => o.id === n.id))]);
    setCursor(res.data.nextCursor);
  }

  if (items.length === 0) {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-lilac/10 text-accent">
          <Sparkles size={26} />
        </span>
        <h2 className="font-display text-2xl">{t("Aucun Moment pour ces filtres")}</h2>
        <p className="mt-2 max-w-sm text-muted">{t("Élargis la date ou la ville… ou lance le tien : il suffit d'une idée et de quelques places.")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-secondary">{t("Voir tous les Moments")}</Link>
          <Link href={signedIn ? "/moments/nouveau" : "/connexion?suite=/moments/nouveau"} className="btn-primary">{t("Créer un Moment")}</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((m, i) => (
          <li key={m.id}>
            <MomentCard moment={m} autoplay={autoplay} priority={i < 2} />
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-col items-center gap-2">
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        {cursor ? (
          <button type="button" onClick={more} disabled={loading} className="btn-secondary">
            {loading && <Loader2 size={16} className="animate-spin" />} {t("Voir plus de Moments")}
          </button>
        ) : (
          <p className="text-sm text-muted">{t("Tu as tout vu pour l'instant. Et si tu créais le prochain ?")}</p>
        )}
      </div>
    </>
  );
}

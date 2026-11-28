"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { api } from "@/lib/client";
import { useT } from "./I18nProvider";

type Item = { id: string; selfieUrl: string; photoUrl: string; reason: string; createdAt: string; steps: { id: string; label: string; icon: string }[]; age: number | null; user: { name: string; username: string } };

/** File des certifications : selfie en direct à gauche, photo de profil à droite. */
export function AdminVerifications({ items }: { items: Item[] }) {
  const t = useT();
  const [done, setDone] = useState<Record<string, "ok" | "ko" | string>>({});
  async function review(id: string, approve: boolean) {
    const res = await api(`/api/admin/verifications/${id}`, { body: { approve } });
    setDone((d) => ({ ...d, [id]: res.ok ? (approve ? "ok" : "ko") : res.error.message }));
  }
  if (items.length === 0) return <p className="text-sm text-muted">{t("Aucun profil en attente : l'IA a tout traité.")}</p>;
  return (
    <ul className="space-y-4">
      {items.map((v) => (
        <li key={v.id} className="card space-y-3 p-4">
          <p className="text-sm"><span className="font-semibold">{v.user.name}</span> <span className="text-muted">@{v.user.username}{v.age !== null ? ` · ${t("{n} ans (déclaré)", { n: v.age })}` : ""}</span></p>
          <p className="text-xs text-muted">{t("Mouvements demandés, dans l'ordre")} : {v.steps.map((s) => `${s.icon} ${t(s.label)}`).join(" · ")}</p>
          {v.reason && <p className="text-xs text-muted">{t(v.reason)}</p>}
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.photoUrl} alt="" className="aspect-square w-full rounded-2xl object-cover" />
              <figcaption className="mt-1 text-center text-xs text-muted">{t("Photo de profil")}</figcaption>
            </figure>
            <figure>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={v.selfieUrl} alt="" className="w-full rounded-2xl object-cover" />
              <figcaption className="mt-1 text-center text-xs text-muted">{t("Vidéo en direct, image par image")}</figcaption>
            </figure>
          </div>
          {done[v.id] ? (
            <p className="text-sm font-semibold">{done[v.id] === "ok" ? t("Certifiée") : done[v.id] === "ko" ? t("Refusée") : t(done[v.id])}</p>
          ) : (
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => review(v.id, false)}><X size={16} /> {t("Refuser")}</button>
              <button type="button" className="btn-primary flex-1" onClick={() => review(v.id, true)}><Check size={16} /> {t("Certifier")}</button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

import { AtSign, MapPin, Star } from "lucide-react";
import type { MomentCardDTO } from "@/server/types";
import { Avatar } from "./Avatar";
import { DemoBadge } from "./DemoBadge";
import { MomentCard } from "./MomentCard";
import { getLocale, getT } from "@/lib/i18n/server";
import { intlLocale } from "@/lib/i18n/core";

type Profile = {
  name: string;
  username: string;
  bio: string;
  city: string;
  interests: string[];
  photoUrl: string | null;
  isDemo: boolean;
  memberSince: string;
  hosted: MomentCardDTO[];
  attended: MomentCardDTO[];
  showPastMoments: boolean;
  isSelf: boolean;
  instagram?: string | null;
  gallery?: string[];
  reputation?: { avg: number | null; count: number; hostAvg: number | null; hostCount: number; badges: string[] } | null;
};

export async function ProfileHeader({ p, children }: { p: Profile; children?: React.ReactNode }) {
  const t = await getT();
  const since = new Intl.DateTimeFormat(intlLocale(await getLocale()), { month: "long", year: "numeric" }).format(new Date(p.memberSince));
  const lived = p.attended.filter((m) => m.phase === "ended").length + p.hosted.filter((m) => m.phase === "ended").length;
  return (
    <section className="card overflow-hidden">
      <div className="h-28 bg-signature sm:h-36" />
      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
          <span className="rounded-full bg-surface p-1"><Avatar person={p} size="xl" /></span>
          {children}
        </div>
        <h1 className="font-display mt-3 flex flex-wrap items-center gap-2 text-3xl">
          {p.name} {p.isDemo && <DemoBadge />}
        </h1>
        <p className="text-muted">@{p.username}</p>
        {p.bio && <p className="mt-3 max-w-xl text-ink-2">{t(p.bio)}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>}
          <span>{t("Membre depuis {date}", { date: since })}</span>
          {p.reputation && (p.reputation.hostAvg ?? p.reputation.avg) !== null && (
            <span className="flex items-center gap-1 text-ink-2">
              <Star size={14} className="fill-current text-amber-400" /> {(p.reputation.hostAvg ?? p.reputation.avg)!.toFixed(1).replace(".", ",")}/5
              <span className="text-muted">· {t("{n} avis", { n: p.reputation.hostAvg !== null ? p.reputation.hostCount : p.reputation.count })}</span>
            </span>
          )}
        </div>
        {p.instagram && (
          <a
            href={`https://instagram.com/${p.instagram}`}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface-2/70 px-3 py-1.5 text-sm text-ink-2 hover:text-ink"
          >
            <AtSign size={14} /> instagram.com/{p.instagram} <span className="text-xs text-muted">· {t("non vérifié")}</span>
          </a>
        )}
        {p.reputation && p.reputation.badges.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("Badges")}>
            {p.reputation.badges.map((b) => <li key={b} className="pill bg-accent/15 text-ink">{t(b)}</li>)}
          </ul>
        )}
        {p.interests.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("Centres d'intérêt")}>
            {p.interests.map((i) => <li key={i} className="pill bg-lilac/10 text-ink-2">{t(i)}</li>)}
          </ul>
        )}
        {p.gallery && p.gallery.length > 0 && (
          <ul className="mt-5 flex snap-x gap-2 overflow-x-auto pb-1" aria-label={t("Photos")}>
            {p.gallery.map((url) => (
              <li key={url} className="aspect-[4/5] w-28 shrink-0 snap-start overflow-hidden rounded-2xl bg-surface-2 sm:w-36">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
              </li>
            ))}
          </ul>
        )}
        <dl className="mt-5 grid max-w-sm grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-surface-2/60 py-2.5"><dt className="text-xs text-muted">{t("Créés")}</dt><dd className="font-display text-xl">{p.hosted.filter((m) => m.status !== "DRAFT").length}</dd></div>
          <div className="rounded-2xl bg-surface-2/60 py-2.5"><dt className="text-xs text-muted">{t("Rejoints")}</dt><dd className="font-display text-xl">{p.attended.length}</dd></div>
          <div className="rounded-2xl bg-surface-2/60 py-2.5"><dt className="text-xs text-muted">{t("Vécus")}</dt><dd className="font-display text-xl">{lived}</dd></div>
        </dl>
      </div>
    </section>
  );
}

export async function ProfileMoments({ p, narrow = false }: { p: Profile; narrow?: boolean }) {
  const t = await getT();
  const grid = narrow ? "grid grid-cols-1 gap-5 sm:grid-cols-2" : "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3";
  const upcomingHosted = p.hosted.filter((m) => m.phase === "upcoming" || m.phase === "ongoing" || (p.isSelf && m.phase === "draft"));
  const past = [...p.hosted.filter((m) => m.phase === "ended"), ...p.attended.filter((m) => m.phase === "ended")];
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display mb-4 text-2xl">{p.isSelf ? t("Mes Moments") : t("Ses prochains Moments")}</h2>
        {upcomingHosted.length === 0 ? (
          <p className="text-muted">{t("Aucun Moment à venir.")}</p>
        ) : (
          <ul className={grid}>{upcomingHosted.map((m) => <li key={m.id}><MomentCard moment={m} autoplay={false} /></li>)}</ul>
        )}
      </section>
      {(p.showPastMoments || p.isSelf) && (
        <section>
          <h2 className="font-display mb-1 text-2xl">{t("Moments vécus")}</h2>
          {p.isSelf && !p.showPastMoments && <p className="mb-3 text-sm text-muted">{t("Masqués sur ton profil public (réglage ci-dessous).")}</p>}
          {past.length === 0 ? (
            <p className="mt-3 text-muted">{t("Pas encore de Moment vécu.")}</p>
          ) : (
            <ul className={`mt-4 ${grid}`}>{past.map((m) => <li key={`p-${m.id}`}><MomentCard moment={m} autoplay={false} /></li>)}</ul>
          )}
        </section>
      )}
    </div>
  );
}

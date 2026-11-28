import Link from "next/link";
import { AtSign, Camera, MapPin, Star } from "lucide-react";
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
  tier?: "free" | "plus" | "black";
  memberSince: string;
  hosted: MomentCardDTO[];
  attended: MomentCardDTO[];
  showPastMoments: boolean;
  isSelf: boolean;
  instagram?: string | null;
  gallery?: string[];
  verified?: boolean;
  reputation?: {
    avg: number | null; count: number; hostAvg: number | null; hostCount: number; badges: string[];
    qualities?: { id: string; label: string; icon: string; count: number; share: number }[];
    againPct?: number | null;
  } | null;
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
          {p.tier === "plus" && <span className="pill bg-accent/15 font-sans text-xs font-semibold text-ink">Upclose+</span>}
          {p.tier === "black" && <span className="pill border border-white/25 bg-night font-sans text-xs font-semibold text-white">Black</span>}
          {p.verified && (
            <span className="pill gap-1.5 bg-white/90 font-sans text-xs font-semibold text-[#1a1530]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/upclose-symbol.svg" alt="" width={13} height={15} /> {t("Photo certifiée")}
            </span>
          )}
        </h1>
        <p className="text-muted">@{p.username}</p>
        {p.bio && <p className="mt-3 max-w-xl text-ink-2">{t(p.bio)}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>}
          <span>{t("Membre depuis {date}", { date: since })}</span>
          {p.reputation && (p.reputation.hostAvg ?? p.reputation.avg) !== null && (
            <Link href={`/u/${p.username}/avis`} className="flex items-center gap-1 text-ink-2 underline-offset-2 hover:underline">
              <Star size={14} className="fill-current text-amber-400" /> {(p.reputation.hostAvg ?? p.reputation.avg)!.toFixed(1).replace(".", ",")}/5
              <span className="text-muted">· {t("{n} avis", { n: p.reputation.hostAvg !== null ? p.reputation.hostCount : p.reputation.count })}</span>
            </Link>
          )}
        </div>
        {p.isSelf && !p.verified && (
          <Link href="/moi/certification" className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm font-medium text-ink hover:bg-accent/20">
            <Camera size={15} /> {t("Certifier ma photo")} <span className="text-xs text-muted">· {t("gratuit, 20 secondes")}</span>
          </Link>
        )}
        {p.reputation?.qualities && p.reputation.qualities.length > 0 && (
          <Link href={`/u/${p.username}/avis`} className="mt-4 block max-w-xl rounded-2xl bg-surface-2/60 p-3 hover:bg-surface-2">
            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted">{t("Ses points forts")}</span>
              {typeof p.reputation.againPct === "number" && (
                <span className="text-xs text-ink-2">{t("{n} % referaient un Moment ensemble", { n: p.reputation.againPct })}</span>
              )}
            </span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.reputation.qualities.slice(0, 5).map((q) => (
                <span key={q.id} className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-surface px-2.5 py-1 text-sm font-semibold text-ink">
                  <span aria-hidden>{q.icon}</span> {t(q.label)} <span className="text-xs font-normal text-muted">×{q.count}</span>
                </span>
              ))}
            </div>
          </Link>
        )}
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

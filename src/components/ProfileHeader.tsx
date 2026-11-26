import { MapPin } from "lucide-react";
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
};

export async function ProfileHeader({ p, children }: { p: Profile; children?: React.ReactNode }) {
  const t = await getT();
  const since = new Intl.DateTimeFormat(intlLocale(await getLocale()), { month: "long", year: "numeric" }).format(new Date(p.memberSince));
  const lived = p.attended.filter((m) => m.phase === "ended").length + p.hosted.filter((m) => m.phase === "ended").length;
  return (
    <section className="card overflow-hidden">
      <div className="h-28 bg-gradient-to-br from-rose via-[#a0479f] to-violet sm:h-36" />
      <div className="px-5 pb-6 sm:px-8">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
          <span className="rounded-full bg-paper p-1"><Avatar person={p} size="xl" /></span>
          {children}
        </div>
        <h1 className="font-display mt-3 flex flex-wrap items-center gap-2 text-3xl">
          {p.name} {p.isDemo && <DemoBadge />}
        </h1>
        <p className="text-muted">@{p.username}</p>
        {p.bio && <p className="mt-3 max-w-xl text-ink-soft">{t(p.bio)}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>}
          <span>{t("Membre depuis {date}", { date: since })}</span>
        </div>
        {p.interests.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={t("Centres d'intérêt")}>
            {p.interests.map((i) => <li key={i} className="pill bg-sand text-ink-soft">{t(i)}</li>)}
          </ul>
        )}
        <dl className="mt-5 grid max-w-sm grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-sand/60 py-2.5"><dt className="text-xs text-muted">{t("Créés")}</dt><dd className="font-display text-xl">{p.hosted.filter((m) => m.status !== "DRAFT").length}</dd></div>
          <div className="rounded-2xl bg-sand/60 py-2.5"><dt className="text-xs text-muted">{t("Rejoints")}</dt><dd className="font-display text-xl">{p.attended.length}</dd></div>
          <div className="rounded-2xl bg-sand/60 py-2.5"><dt className="text-xs text-muted">{t("Vécus")}</dt><dd className="font-display text-xl">{lived}</dd></div>
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

import { MapPin } from "lucide-react";
import type { MomentCardDTO } from "@/server/types";
import { Avatar } from "./Avatar";
import { DemoBadge } from "./DemoBadge";
import { MomentCard } from "./MomentCard";

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

export function ProfileHeader({ p, children }: { p: Profile; children?: React.ReactNode }) {
  const since = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(new Date(p.memberSince));
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
        {p.bio && <p className="mt-3 max-w-xl text-ink-soft">{p.bio}</p>}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          {p.city && <span className="flex items-center gap-1"><MapPin size={14} /> {p.city}</span>}
          <span>Membre depuis {since}</span>
        </div>
        {p.interests.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Centres d'intérêt">
            {p.interests.map((i) => <li key={i} className="pill bg-sand text-ink-soft">{i}</li>)}
          </ul>
        )}
        <dl className="mt-5 grid max-w-sm grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-sand/60 py-2.5"><dt className="text-xs text-muted">Créés</dt><dd className="font-display text-xl">{p.hosted.filter((m) => m.status !== "DRAFT").length}</dd></div>
          <div className="rounded-2xl bg-sand/60 py-2.5"><dt className="text-xs text-muted">Rejoints</dt><dd className="font-display text-xl">{p.attended.length}</dd></div>
          <div className="rounded-2xl bg-sand/60 py-2.5"><dt className="text-xs text-muted">Vécus</dt><dd className="font-display text-xl">{lived}</dd></div>
        </dl>
      </div>
    </section>
  );
}

export function ProfileMoments({ p, narrow = false }: { p: Profile; narrow?: boolean }) {
  const grid = narrow ? "grid gap-5 sm:grid-cols-2" : "grid gap-5 sm:grid-cols-2 xl:grid-cols-3";
  const upcomingHosted = p.hosted.filter((m) => m.phase === "upcoming" || m.phase === "ongoing" || (p.isSelf && m.phase === "draft"));
  const past = [...p.hosted.filter((m) => m.phase === "ended"), ...p.attended.filter((m) => m.phase === "ended")];
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display mb-4 text-2xl">{p.isSelf ? "Mes Moments" : "Ses prochains Moments"}</h2>
        {upcomingHosted.length === 0 ? (
          <p className="text-muted">Aucun Moment à venir.</p>
        ) : (
          <ul className={grid}>{upcomingHosted.map((m) => <li key={m.id}><MomentCard moment={m} autoplay={false} /></li>)}</ul>
        )}
      </section>
      {(p.showPastMoments || p.isSelf) && (
        <section>
          <h2 className="font-display mb-1 text-2xl">Moments vécus</h2>
          {p.isSelf && !p.showPastMoments && <p className="mb-3 text-sm text-muted">Masqués sur ton profil public (réglage ci-dessous).</p>}
          {past.length === 0 ? (
            <p className="mt-3 text-muted">Pas encore de Moment vécu.</p>
          ) : (
            <ul className={`mt-4 ${grid}`}>{past.map((m) => <li key={`p-${m.id}`}><MomentCard moment={m} autoplay={false} /></li>)}</ul>
          )}
        </section>
      )}
    </div>
  );
}

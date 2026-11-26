import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Clock, Eye, Lock, MapPin, Users } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { categoryLabel, visibilityInfo } from "@/config/product";
import { formatLongDate, formatMomentTime } from "@/lib/time";
import { loadMomentDetail } from "@/server/loaders";
import { Avatar } from "@/components/Avatar";
import { DemoBadge } from "@/components/DemoBadge";
import { MomentMedia } from "@/components/MomentMedia";
import { ShareButton } from "@/components/ShareButton";
import { JoinPanel } from "@/components/JoinPanel";
import { HostPanel } from "@/components/HostPanel";
import { SafetyActions } from "@/components/SafetyActions";
import { EmptyState, OfflineDemoNotice } from "@/components/States";
import { spotsLabel } from "@/components/moment-labels";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function load(id: string) {
  const viewer = await getViewerSafe();
  try {
    return { viewer, ...(await loadMomentDetail(viewer, id)), denied: false as const };
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    if (e instanceof AppError && e.code === "FORBIDDEN") return { viewer, denied: true as const };
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const r = await load(id);
    if (r.denied) return { title: "Moment privé" };
    return { title: r.moment.title, description: r.moment.description.slice(0, 160) };
  } catch {
    return { title: "Moment" };
  }
}

export default async function MomentPage({ params }: Props) {
  const { id } = await params;
  const r = await load(id);
  if (r.denied) {
    return (
      <div className="mx-auto mt-6 max-w-lg">
        <EmptyState icon="lock" title="Moment sur invitation" text="Ce Moment n'est visible que par les personnes invitées par l'hôte." action={{ href: "/", label: "Découvrir d'autres Moments" }} />
      </div>
    );
  }
  const { moment: m, viewer, source } = r;
  const vis = visibilityInfo[m.visibility];
  const time = `${formatMomentTime(m.startsAt, m.timezone)}${m.endsAt ? ` – ${formatMomentTime(m.endsAt, m.timezone)}` : ""}`;

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> Retour au feed
      </Link>
      {source === "demo-fallback" && <OfflineDemoNotice />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="relative aspect-[4/5] max-h-[72vh] w-full overflow-hidden rounded-[2rem] bg-ink shadow-[var(--shadow-lift)]">
            <MomentMedia moment={m} priority sizes="(min-width: 1024px) 45vw, 100vw" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute left-4 top-4 flex gap-1.5">
              <span className="pill bg-white/90 text-ink">{categoryLabel(m.category)}</span>
              {m.isDemo && <DemoBadge />}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <header>
            {m.phase === "cancelled" && <p className="pill mb-3 bg-danger-soft text-danger">Annulé</p>}
            {m.phase === "ended" && <p className="pill mb-3 bg-sand text-muted">Terminé</p>}
            {m.phase === "ongoing" && <p className="pill mb-3 bg-success-soft text-success">En cours</p>}
            {m.phase === "draft" && <p className="pill mb-3 bg-warn-soft text-warn">Brouillon, visible par toi seul</p>}
            <h1 className="font-display text-[clamp(2rem,5.5vw,3.1rem)] leading-[1.04] [text-wrap:balance]">{m.title}</h1>
            {m.vibeTags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Ambiance">
                {m.vibeTags.map((t) => (
                  <li key={t} className="pill bg-violet-soft text-violet">#{t}</li>
                ))}
              </ul>
            )}
          </header>

          <dl className="card divide-y divide-line">
            <div className="flex items-start gap-3 px-5 py-4">
              <CalendarDays size={20} className="mt-0.5 shrink-0 text-rose" aria-hidden />
              <div>
                <dt className="sr-only">Date</dt>
                <dd className="font-semibold first-letter:uppercase">{formatLongDate(m.startsAt, m.timezone)}</dd>
                <dd className="flex items-center gap-1 text-sm text-muted"><Clock size={13} aria-hidden /> {time} · heure de {m.city}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <MapPin size={20} className="mt-0.5 shrink-0 text-rose" aria-hidden />
              <div>
                <dt className="sr-only">Lieu</dt>
                <dd className="font-semibold">{m.placeName || m.area}</dd>
                <dd className="text-sm text-muted">{[m.area, m.city].filter(Boolean).join(", ")}</dd>
                {m.address && <dd className="mt-1 text-sm font-medium text-ink">{m.address}</dd>}
                {m.addressHidden && (
                  <dd className="mt-1 flex items-center gap-1 text-sm text-muted"><Lock size={13} aria-hidden /> Adresse exacte communiquée aux participants confirmés</dd>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <Users size={20} className="mt-0.5 shrink-0 text-rose" aria-hidden />
              <div className="min-w-0 flex-1">
                <dt className="sr-only">Places</dt>
                <dd className="font-semibold">{spotsLabel(m)}</dd>
                <dd className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sand" aria-hidden>
                  <span className="block h-full rounded-full bg-gradient-to-r from-rose to-violet" style={{ width: `${Math.min(100, (m.acceptedCount / m.capacity) * 100)}%` }} />
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <Eye size={20} className="mt-0.5 shrink-0 text-rose" aria-hidden />
              <div>
                <dt className="sr-only">Accès</dt>
                <dd className="font-semibold">{vis.label}</dd>
                <dd className="text-sm text-muted">{vis.help}</dd>
              </div>
            </div>
          </dl>

          <section className="card p-5">
            {m.isHost ? (
              <>
                <h2 className="mb-4 font-display text-xl">Gérer mon Moment</h2>
                <HostPanel moment={m} />
              </>
            ) : (
              <JoinPanel moment={m} signedIn={!!viewer} readOnly={source === "demo-fallback"} />
            )}
          </section>

          <section>
            <h2 className="font-display text-xl">L&apos;ambiance</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">{m.description}</p>
          </section>

          <section className="flex items-center gap-3">
            <Link href={`/u/${m.host.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 hover:bg-sand/60">
              <Avatar person={m.host} size="lg" />
              <span className="min-w-0">
                <span className="eyebrow">Hôte</span>
                <span className="flex items-center gap-2 font-semibold">{m.host.name} {m.host.isDemo && <DemoBadge />}</span>
                <span className="text-sm text-muted">@{m.host.username}</span>
              </span>
            </Link>
            <ShareButton path={`/moments/${m.id}`} title={m.title} />
          </section>

          {!m.isHost && (
            <section>
              <h2 className="font-display text-xl">Participants</h2>
              {!m.showAttendees ? (
                <p className="mt-2 text-sm text-muted">L&apos;hôte a choisi de ne pas afficher la liste des participants.</p>
              ) : m.attendees.length === 0 ? (
                <p className="mt-2 text-sm text-muted">Aucun participant visible pour l&apos;instant.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {m.attendees.map((p) => (
                    <li key={p.id}>
                      <Link href={`/u/${p.username}`} className="flex items-center gap-2 rounded-full border border-line bg-paper py-1 pl-1 pr-3 text-sm font-medium hover:bg-sand">
                        <Avatar person={p} size="sm" /> {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {m.attendees.length < m.acceptedCount && m.showAttendees && (
                <p className="mt-2 text-xs text-muted">Certains participants ont choisi de ne pas apparaître.</p>
              )}
            </section>
          )}

          {viewer && !m.isHost && source === "database" && (
            <div className="border-t border-line pt-4">
              <SafetyActions username={m.host.username} momentId={m.id} label="ce Moment" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

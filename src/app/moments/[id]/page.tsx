import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Eye, Lock, MapPin, ShieldCheck, Star, Users } from "lucide-react";
import { prisma } from "@/lib/db";
import { getViewerSafe } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { categoryLabel, productConfig, visibilityInfo } from "@/config/product";
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
import { getLocale, getT } from "@/lib/i18n/server";
import { HostMatches, MomentChat, RateMoment, Souvenirs } from "@/components/MomentCircle";
import { listSouvenirs, type SouvenirDTO } from "@/server/souvenirs";
import { reputations } from "@/server/ratings";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }>; searchParams?: Promise<Record<string, string | string[] | undefined>> };

async function load(id: string) {
  const viewer = await getViewerSafe();
  try {
    return { viewer, ...(await loadMomentDetail(viewer, id)), denied: false as const };
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    if (e instanceof AppError && e.code === "FORBIDDEN") return { viewer, denied: true as const };
    if (e instanceof AppError && e.code === "ADULT_ONLY") return { viewer, denied: true as const, adult: true };
    throw e;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await getT();
  try {
    const r = await load(id);
    if (r.denied) return { title: t("Moment privé") };
    return { title: t(r.moment.title), description: t(r.moment.description).slice(0, 160) };
  } catch {
    return { title: "Moment" };
  }
}

export default async function MomentPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const r = await load(id);
  const t = await getT();
  const locale = await getLocale();
  if (r.denied && "adult" in r) {
    return (
      <div className="mx-auto mt-6 max-w-lg">
        <EmptyState icon="lock" title={t("Espace adulte (18+)")} text={t("Ce Moment fait partie de l'espace adulte. Il n'est visible que par les membres majeurs qui ont choisi de l'activer dans leur profil.")} action={{ href: "/moi#espace-adulte", label: t("Voir l'espace adulte") }} />
      </div>
    );
  }
  if (r.denied) {
    return (
      <div className="mx-auto mt-6 max-w-lg">
        <EmptyState icon="lock" title={t("Moment sur invitation")} text={t("Ce Moment n'est visible que par les personnes invitées par l'hôte.")} action={{ href: "/", label: t("Découvrir d'autres Moments") }} />
      </div>
    );
  }
  const { moment: m, viewer, source } = r;
  const vis = visibilityInfo[m.visibility];
  const time = `${formatMomentTime(m.startsAt, m.timezone, locale)}${m.endsAt ? ` – ${formatMomentTime(m.endsAt, m.timezone, locale)}` : ""}`;
  const title = t(m.title);
  // Repères de confiance sur l'hôte : ancienneté et Moments déjà organisés.
  const hostInfo =
    source === "database"
      ? await prisma.user
          .findUnique({
            where: { id: m.host.id },
            select: { createdAt: true, _count: { select: { hostedMoments: { where: { status: "PUBLISHED", startsAt: { lt: new Date() } } } } } },
          })
          .catch(() => null)
      : null;
  const since = hostInfo ? new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-GB", { month: "long", year: "numeric" }).format(hostInfo.createdAt) : null;
  const pastHosted = hostInfo?._count.hostedMoments ?? 0;
  const invitation = sp.invitation === "envoyee" ? "sent" : sp.invitation === "echec" ? "failed" : null;
  // Le cercle du Moment : l'hôte et les participants confirmés (discussion, souvenirs, notes).
  const inCircle = source === "database" && !!viewer && (m.isHost || m.viewerMembership?.status === "ACCEPTED");
  const past = m.phase === "ended" || m.phase === "ongoing";
  const souvenirs: SouvenirDTO[] =
    source === "database" && viewer && productConfig.features.posts && past ? await listSouvenirs(viewer, m.id).catch(() => []) : [];
  const hostRep = source === "database" ? (await reputations([m.host.id]).catch(() => new Map())).get(m.host.id) : undefined;
  const hostScore = hostRep ? (hostRep.hostAvg ?? hostRep.avg) : null;

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft size={16} /> {t("Retour au feed")}
      </Link>
      {source === "demo-fallback" && <OfflineDemoNotice />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-10">
        <div className="lg:sticky lg:top-8 lg:self-start">
          <div className="relative aspect-[4/5] max-h-[72vh] w-full overflow-hidden rounded-[2rem] bg-night shadow-[var(--shadow-lift)]">
            <MomentMedia moment={m} priority sizes="(min-width: 1024px) 45vw, 100vw" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
            <div className="absolute left-4 top-4 flex gap-1.5">
              <span className="pill bg-white/90 text-night">{t(categoryLabel(m.category))}</span>
              {m.isDemo && <DemoBadge />}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <header>
            {m.phase === "cancelled" && <p className="pill mb-3 bg-danger-soft text-danger">{t("Annulé")}</p>}
            {m.phase === "ended" && <p className="pill mb-3 bg-lilac/10 text-muted">{t("Terminé")}</p>}
            {m.phase === "ongoing" && <p className="pill mb-3 bg-success-soft text-success">{t("En cours")}</p>}
            {m.phase === "draft" && <p className="pill mb-3 bg-surface-2 text-accent">{t("Brouillon, visible par toi seul")}</p>}
            <h1 className="font-display text-[clamp(2rem,5.5vw,3.1rem)] leading-[1.04] [text-wrap:balance]">{title}</h1>
            {m.vibeTags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("Ambiance")}>
                {m.vibeTags.map((tag) => (
                  <li key={tag} className="pill bg-lilac/10 text-accent">#{t(tag)}</li>
                ))}
              </ul>
            )}
          </header>

          <dl className="card divide-y divide-border">
            <div className="flex items-start gap-3 px-5 py-4">
              <CalendarDays size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div>
                <dt className="sr-only">{t("Date")}</dt>
                <dd className="font-semibold first-letter:uppercase">{formatLongDate(m.startsAt, m.timezone, locale)}</dd>
                <dd className="flex items-center gap-1 text-sm text-muted"><Clock size={13} aria-hidden /> {time} · {t("heure de {city}", { city: m.city })}</dd>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <MapPin size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div>
                <dt className="sr-only">{t("Lieu")}</dt>
                <dd className="font-semibold">{t(m.placeName || m.area)}</dd>
                <dd className="text-sm text-muted">{[t(m.area), m.city].filter(Boolean).join(", ")}</dd>
                {m.address && <dd className="mt-1 text-sm font-medium text-ink">{t(m.address)}</dd>}
                {m.addressHidden && (
                  <dd className="mt-1 flex items-center gap-1 text-sm text-muted"><Lock size={13} aria-hidden /> {t("Adresse exacte communiquée aux participants confirmés")}</dd>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <Users size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div className="min-w-0 flex-1">
                <dt className="sr-only">{t("Places")}</dt>
                <dd className="font-semibold">{spotsLabel(m, t)}</dd>
                <dd className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                  <span className="block h-full rounded-full bg-signature-x" style={{ width: `${Math.min(100, (m.acceptedCount / m.capacity) * 100)}%` }} />
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3 px-5 py-4">
              <Eye size={20} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <div>
                <dt className="sr-only">{t("Accès")}</dt>
                <dd className="font-semibold">{t(vis.label)}</dd>
                <dd className="text-sm text-muted">{t(vis.help)}</dd>
              </div>
            </div>
          </dl>

          {invitation && m.isHost && (
            <p role="status" className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${invitation === "sent" ? "bg-success-soft text-success" : "bg-warn-soft text-warn"}`}>
              <CheckCircle2 size={18} className="shrink-0" aria-hidden />
              {invitation === "sent" ? t("Moment publié et invitation envoyée. Tu verras sa réponse ici.") : t("Moment publié, mais l'invitation n'a pas pu partir. Invite la personne depuis « Gérer mon Moment ».")}
            </p>
          )}

          <section className="card p-5">
            {m.isHost ? (
              <>
                <h2 className="mb-4 font-display text-xl">{t("Gérer mon Moment")}</h2>
                <HostPanel moment={m} />
              </>
            ) : (
              <JoinPanel moment={m} signedIn={!!viewer} readOnly={source === "demo-fallback"} viewerIsDemo={!!viewer?.isDemo} />
            )}
          </section>

          {inCircle && m.phase === "ended" && productConfig.features.ratings && <div id="noter" className="scroll-mt-20"><RateMoment momentId={m.id} /></div>}

          {inCircle && productConfig.features.messaging && m.phase !== "ended" && <MomentChat momentId={m.id} closed={m.phase === "cancelled"} />}

          {m.isHost && source === "database" && (m.phase === "upcoming" || m.phase === "ongoing") && m.spotsLeft > 0 && <HostMatches momentId={m.id} />}

          {productConfig.features.posts && past && m.phase !== "cancelled" && <Souvenirs momentId={m.id} canAdd={inCircle} initial={souvenirs} />}

          {!inCircle && viewer && productConfig.features.messaging && (m.phase === "upcoming" || m.phase === "ongoing") && (
            <p className="flex items-center gap-2 rounded-2xl bg-surface-2/60 px-4 py-3 text-sm text-muted">
              <Lock size={15} className="shrink-0" aria-hidden /> {t("Une discussion de groupe s'ouvre pour les participants confirmés.")}
            </p>
          )}

          <section>
            <h2 className="font-display text-xl">{t("L'ambiance")}</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-2">{t(m.description)}</p>
          </section>

          <section className="flex items-center gap-3">
            <Link href={`/u/${m.host.username}`} className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl p-1 hover:bg-surface-2/60">
              <Avatar person={m.host} size="lg" />
              <span className="min-w-0">
                <span className="eyebrow">{t("Hôte")}</span>
                <span className="flex items-center gap-2 font-semibold">{m.host.name} {m.host.isDemo && <DemoBadge />}</span>
                <span className="block text-sm text-muted">@{m.host.username}</span>
                {hostScore !== null && hostScore !== undefined && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs font-semibold text-warn">
                    <Star size={12} className="fill-warn" aria-hidden /> {hostScore.toFixed(1).replace(".", ",")}/5 · {t("{n} avis", { n: hostRep!.hostAvg !== null ? hostRep!.hostCount : hostRep!.count })}
                    {hostRep!.badges.slice(0, 2).map((b: string) => (
                      <span key={b} className="pill ml-1 bg-lilac/10 text-accent">{t(b)}</span>
                    ))}
                  </span>
                )}
                {since && (
                  <span className="block text-xs text-muted">
                    {t("Membre depuis {date}", { date: since })}
                    {pastHosted > 0 && ` · ${pastHosted > 1 ? t("{n} Moments organisés", { n: pastHosted }) : t("1 Moment organisé")}`}
                  </span>
                )}
              </span>
            </Link>
            <ShareButton path={`/moments/${m.id}`} title={title} />
          </section>

          {!m.isHost && (
            <section>
              <h2 className="font-display text-xl">{t("Participants")}</h2>
              {!m.showAttendees ? (
                <p className="mt-2 text-sm text-muted">{t("L'hôte a choisi de ne pas afficher la liste des participants.")}</p>
              ) : m.attendees.length === 0 ? (
                <p className="mt-2 text-sm text-muted">{t("Aucun participant visible pour l'instant.")}</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-3">
                  {m.attendees.map((p) => (
                    <li key={p.id}>
                      <Link href={`/u/${p.username}`} className="flex items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-sm font-medium hover:bg-surface-2">
                        <Avatar person={p} size="sm" /> {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {m.attendees.length < m.acceptedCount && m.showAttendees && (
                <p className="mt-2 text-xs text-muted">{t("Certains participants ont choisi de ne pas apparaître.")}</p>
              )}
            </section>
          )}

          <section className="card p-5" aria-labelledby="privacy-title">
            <h2 id="privacy-title" className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={18} className="text-success" aria-hidden /> {t("Ce que les autres voient")}
            </h2>
            <ul className="mt-3 space-y-2.5 text-sm text-ink-2">
              <li className="flex gap-2">
                <Eye size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                <span>
                  {m.visibility === "INVITE_ONLY"
                    ? t("Ce Moment n'apparaît pas dans le feed : seules les personnes invitées le voient.")
                    : m.visibility === "PRIVATE"
                      ? t("Ce Moment n'apparaît pas dans le feed : il faut le lien pour le voir.")
                      : t("Ce Moment apparaît dans le feed des membres connectés.")}
                </span>
              </li>
              <li className="flex gap-2">
                <Lock size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                <span>
                  {!m.address && !m.addressHidden
                    ? t("Pas d'adresse exacte publiée : seuls le lieu et la zone sont affichés.")
                    : m.addressMembersOnly
                      ? t("L'adresse exacte n'est donnée qu'aux participants confirmés.")
                      : t("L'adresse exacte est visible par tous ceux qui voient ce Moment.")}
                </span>
              </li>
              <li className="flex gap-2">
                <Users size={16} className="mt-0.5 shrink-0 text-muted" aria-hidden />
                <span>
                  {m.showAttendees
                    ? t("Les participants confirmés sont affichés, sauf ceux qui ont choisi de ne pas apparaître.")
                    : t("La liste des participants n'est pas affichée : seul l'hôte la voit.")}
                </span>
              </li>
            </ul>
          </section>

          {viewer && !m.isHost && source === "database" && (
            <div className="border-t border-border pt-4">
              <SafetyActions username={m.host.username} momentId={m.id} label={t("ce Moment")} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useLocale, useT } from "./I18nProvider";
import { CalendarDays, Check, Clock, Mail, Star } from "lucide-react";
import type { MomentCardDTO } from "@/server/types";
import { formatMomentDate, formatMomentTime } from "@/lib/time";
import { Avatar, AvatarStack } from "./Avatar";
import { MomentMedia } from "./MomentMedia";
import { membershipLabel, membershipTone, spotsLabel, statusTone } from "./moment-labels";

const toneClass = {
  neutral: "bg-white/90 text-night",
  hot: "bg-primary text-white",
  full: "bg-night text-white",
  off: "bg-white/80 text-night/70 line-through",
};

const stateClass = {
  ok: "bg-success text-night",
  wait: "bg-warn text-night",
  invite: "bg-primary text-white",
  off: "bg-white/80 text-night",
};
const stateIcon = { ok: Check, wait: Clock, invite: Mail, off: null };

export function MomentCard({ moment, autoplay = true, priority = false }: { moment: MomentCardDTO; autoplay?: boolean; priority?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const href = `/moments/${moment.id}`;
  const mine = membershipLabel(moment.viewerMembership, t);
  const mineTone = membershipTone(moment.viewerMembership);
  const StateIcon = mineTone ? stateIcon[mineTone] : null;
  const title = t(moment.title);
  const tone = statusTone(moment);
  const where = t(moment.area) || moment.city;
  // Un seul badge par carte, le plus utile : ton statut, sinon « Nouveau », sinon 18+.
  const badge = moment.isHost ? (
    <span className="pill bg-violet text-white">{t("Ton Moment")}</span>
  ) : mineTone ? (
    <span className={`pill font-semibold ${stateClass[mineTone]}`}>
      {StateIcon && <StateIcon size={13} strokeWidth={2.6} aria-hidden />} {mine}
    </span>
  ) : moment.isNew ? (
    <span className="pill bg-white/90 text-night">{t("Nouveau")}</span>
  ) : moment.isAdult ? (
    <span className="pill bg-night/80 text-white">18+</span>
  ) : null;
  // Places : affichées seulement quand c'est utile (bientôt complet, complet, terminé).
  const showSpots = tone !== "neutral";
  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-night" aria-label={t("Voir le Moment : {title}", { title })}>
        <MomentMedia moment={moment} autoplay={autoplay} priority={priority} className="transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {badge && <div className="absolute left-3 top-3">{badge}</div>}
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          {moment.mediaType !== "TEXT" && (
            <h3 className="font-display text-[1.6rem] leading-[1.08] [text-wrap:balance] drop-shadow-sm">{title}</h3>
          )}
          <p className="mt-2 flex items-center gap-1.5 text-sm text-white/90">
            <CalendarDays size={14} className="shrink-0" aria-hidden />
            <span className="truncate">
              <span className="capitalize">{formatMomentDate(moment.startsAt, moment.timezone, locale)}</span> · {formatMomentTime(moment.startsAt, moment.timezone, locale)}
              {where && <> · {where}</>}
            </span>
          </p>
          {showSpots && <span className={`pill mt-2 ${toneClass[tone]}`}>{spotsLabel(moment, t)}</span>}
        </div>
      </Link>
      <div className="flex items-center gap-3 px-4 py-3">
        <Link href={`/u/${moment.host.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar person={moment.host} size="sm" />
          <span className="truncate text-sm font-semibold">{moment.host.name}</span>
          {moment.hostRating?.avg != null && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-xs text-ink-2">
              <Star size={11} className="fill-amber-400 text-amber-400" aria-hidden /> {moment.hostRating.avg.toFixed(1).replace(".", ",")}
            </span>
          )}
          {moment.isDemo && <span className="shrink-0 text-xs text-muted">· {t("Démo")}</span>}
        </Link>
        {moment.attendeesPreview.length > 0 && <AvatarStack people={moment.attendeesPreview} max={3} size="xs" />}
      </div>
    </article>
  );
}

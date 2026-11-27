"use client";

import Link from "next/link";
import { useLocale, useT } from "./I18nProvider";
import { CalendarDays, Check, Clock, Hand, Lock, Mail, MapPin, Sparkles, Star, Users, Zap } from "lucide-react";
import type { MomentCardDTO } from "@/server/types";
import { categoryLabel } from "@/config/product";
import { formatMomentDate, formatMomentTime } from "@/lib/time";
import { Avatar, AvatarStack } from "./Avatar";
import { DemoBadge } from "./DemoBadge";
import { MomentMedia } from "./MomentMedia";
import { ShareButton } from "./ShareButton";
import { accessLabel, membershipLabel, membershipTone, spotsLabel, statusTone } from "./moment-labels";

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

const accessIcon = { PUBLIC: Zap, REQUEST: Hand, PRIVATE: Hand, INVITE_ONLY: Lock } as const;

export function MomentCard({ moment, autoplay = true, priority = false }: { moment: MomentCardDTO; autoplay?: boolean; priority?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const href = `/moments/${moment.id}`;
  const mine = membershipLabel(moment.viewerMembership, t);
  const mineTone = membershipTone(moment.viewerMembership);
  const StateIcon = mineTone ? stateIcon[mineTone] : null;
  const title = t(moment.title);
  const tone = statusTone(moment);
  const AccessIcon = accessIcon[moment.visibility];
  const place = [t(moment.placeName), [t(moment.area), moment.city].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const extra = Math.max(0, moment.acceptedCount - Math.min(3, moment.attendeesPreview.length));
  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-night" aria-label={t("Voir le Moment : {title}", { title })}>
        <MomentMedia moment={moment} autoplay={autoplay} priority={priority} className="transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/30" />
        <div className="absolute left-3 right-14 top-3 flex flex-wrap items-center gap-1.5">
          <span className="pill bg-white/90 text-night">{t(categoryLabel(moment.category))}</span>
          {moment.isAdult && <span className="pill bg-night/80 text-white">18+</span>}
          {moment.isDemo && <DemoBadge />}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          {(moment.isHost || mineTone) && (
            <p className="mb-2">
              {moment.isHost ? (
                <span className="pill bg-violet text-white">{t("Ton Moment")}</span>
              ) : (
                mineTone && (
                  <span className={`pill font-semibold ${stateClass[mineTone]}`}>
                    {StateIcon && <StateIcon size={13} strokeWidth={2.6} aria-hidden />} {mine}
                  </span>
                )
              )}
            </p>
          )}
          {moment.mediaType !== "TEXT" && (
            <h3 className="font-display text-[1.7rem] leading-[1.06] [text-wrap:balance] drop-shadow-sm">{title}</h3>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
            <span className="pill bg-black/40 text-white backdrop-blur">
              <CalendarDays size={13} aria-hidden />
              <span className="capitalize">{formatMomentDate(moment.startsAt, moment.timezone, locale)}</span> · {formatMomentTime(moment.startsAt, moment.timezone, locale)}
            </span>
            <span className={`pill ${toneClass[tone]}`}>{spotsLabel(moment, t)}</span>
          </div>
          {place && (
            <p className="mt-2 flex items-center gap-1 text-sm text-white/85">
              <MapPin size={14} className="shrink-0" aria-hidden /> <span className="truncate">{place}</span>
            </p>
          )}
        </div>
      </Link>
      {moment.reasons && moment.reasons.length > 0 && (
        <p className="flex items-center gap-1.5 border-b border-border px-4 py-2 text-xs text-ink-2">
          <Sparkles size={12} className="shrink-0 text-accent" aria-hidden />
          <span className="sr-only">{t("Pourquoi pour toi")} :</span>
          <span className="truncate">{moment.reasons.map((r) => t(r)).join(" · ")}</span>
        </p>
      )}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Link href={`/u/${moment.host.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar person={moment.host} size="sm" />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
              {moment.host.name}
              {moment.hostRating?.avg != null && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-ink-2">
                  <Star size={11} className="fill-amber-400 text-amber-400" aria-hidden /> {moment.hostRating.avg.toFixed(1).replace(".", ",")}
                </span>
              )}
            </span>
            <span className="flex items-center gap-1 truncate text-xs text-muted">
              <AccessIcon size={12} className="shrink-0" aria-hidden />
              {[accessLabel(moment.visibility, t), ...moment.vibeTags.slice(0, 1).map((tag) => `#${t(tag)}`)].join(" · ")}
            </span>
          </span>
        </Link>
        {moment.attendeesPreview.length > 0 ? (
          <span className="flex items-center gap-1.5">
            <AvatarStack people={moment.attendeesPreview} max={3} size="xs" />
            {extra > 0 && <span className="text-xs font-medium text-muted">+{extra}</span>}
          </span>
        ) : moment.acceptedCount > 0 ? (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Users size={14} aria-hidden /> {moment.acceptedCount}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Users size={14} aria-hidden /> {t("Sois le premier")}
          </span>
        )}
        <ShareButton path={href} title={title} compact />
      </div>
    </article>
  );
}

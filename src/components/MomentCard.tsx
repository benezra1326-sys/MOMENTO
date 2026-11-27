"use client";

import Link from "next/link";
import { useLocale, useT } from "./I18nProvider";
import { CalendarDays, MapPin, Users } from "lucide-react";
import type { MomentCardDTO } from "@/server/types";
import { categoryLabel } from "@/config/product";
import { formatMomentDate, formatMomentTime } from "@/lib/time";
import { Avatar, AvatarStack } from "./Avatar";
import { DemoBadge } from "./DemoBadge";
import { MomentMedia } from "./MomentMedia";
import { ShareButton } from "./ShareButton";
import { accessLabel, membershipLabel, spotsLabel, statusTone } from "./moment-labels";

const toneClass = {
  neutral: "bg-white/90 text-ink",
  hot: "bg-rose text-white",
  full: "bg-ink text-white",
  off: "bg-white/80 text-muted line-through",
};

export function MomentCard({ moment, autoplay = true, priority = false }: { moment: MomentCardDTO; autoplay?: boolean; priority?: boolean }) {
  const t = useT();
  const locale = useLocale();
  const href = `/moments/${moment.id}`;
  const mine = membershipLabel(moment.viewerMembership, t);
  const title = t(moment.title);
  const tone = statusTone(moment);
  return (
    <article className="card group overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]">
      <Link href={href} className="relative block aspect-[4/5] overflow-hidden bg-ink" aria-label={t("Voir le Moment : {title}", { title })}>
        <MomentMedia moment={moment} autoplay={autoplay} priority={priority} className="transition-transform duration-700 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/25" />
        <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1.5">
          <span className="pill bg-white/90 text-ink">{t(categoryLabel(moment.category))}</span>
          {moment.isDemo && <DemoBadge />}
          {moment.isHost && <span className="pill bg-violet text-white">{t("Ton Moment")}</span>}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 text-white">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[13px] font-medium">
            <span className="pill bg-black/35 text-white backdrop-blur">
              <CalendarDays size={13} aria-hidden />
              <span className="capitalize">{formatMomentDate(moment.startsAt, moment.timezone, locale)}</span> · {formatMomentTime(moment.startsAt, moment.timezone, locale)}
            </span>
            <span className={`pill ${toneClass[tone]}`}>{spotsLabel(moment, t)}</span>
          </div>
          {moment.mediaType !== "TEXT" && (
            <h3 className="font-display text-[1.65rem] leading-[1.08] [text-wrap:balance]">{title}</h3>
          )}
          <p className="mt-1.5 flex items-center gap-1 text-sm text-white/85">
            <MapPin size={14} aria-hidden /> {[t(moment.area), moment.city].filter(Boolean).join(", ")}
          </p>
        </div>
      </Link>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <Link href={`/u/${moment.host.username}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <Avatar person={moment.host} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{moment.host.name}</span>
            <span className="block truncate text-xs text-muted">
              {mine ?? [accessLabel(moment.visibility, t), ...moment.vibeTags.slice(0, 2).map((tag) => `#${t(tag)}`)].join(" · ")}
            </span>
          </span>
        </Link>
        {moment.attendeesPreview.length > 0 ? (
          <AvatarStack people={moment.attendeesPreview} max={3} size="xs" />
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

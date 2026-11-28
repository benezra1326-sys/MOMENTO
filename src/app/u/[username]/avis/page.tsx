import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Star } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getProfileReviews } from "@/server/accounts";
import { ratingCriteria } from "@/server/ratings";
import { productConfig } from "@/config/product";
import { getLocale, getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toFixed(1).replace(".", ",");

export default async function ProfileReviewsPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getViewerSafe();
  const t = await getT();
  const locale = await getLocale();
  let r;
  try {
    r = await getProfileReviews(viewer, username);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const rep = r.reputation;
  const avg = rep ? rep.hostAvg ?? rep.avg : null;
  const min = productConfig.limits.ratingMinCount;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/u/${r.username}`} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> {r.name}
      </Link>

      <section className="card space-y-4 p-5 sm:p-6">
        <h1 className="font-display text-2xl">{t("Avis sur {name}", { name: r.name })}</h1>
        {avg !== null && rep ? (
          <>
            <p className="flex items-center gap-2 text-3xl font-semibold">
              <Star size={26} className="fill-current text-amber-400" /> {fmt(avg)}<span className="text-base font-normal text-muted">/5 · {t("{n} avis", { n: rep.hostAvg !== null ? rep.hostCount : rep.count })}</span>
            </p>
            {rep.qualities.length > 0 && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("Points forts")}</h2>
                <ul className="space-y-2">
                  {rep.qualities.map((q) => (
                    <li key={q.id} className="flex items-center gap-3 text-sm">
                      <span className="w-6 text-center text-lg" aria-hidden>{q.icon}</span>
                      <span className="w-36 shrink-0 text-ink-2">{t(q.label)}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-signature" style={{ width: `${Math.max(6, q.share)}%` }} />
                      </span>
                      <span className="w-10 text-right font-semibold">{q.count}</span>
                    </li>
                  ))}
                </ul>
                <p className="text-xs text-muted">{t("Nombre de personnes qui ont cité cette qualité après un Moment.")}</p>
              </div>
            )}
            {rep.againPct !== null && (
              <p className="rounded-2xl bg-surface-2/60 px-3 py-2 text-sm"><span className="font-semibold">{rep.againPct} %</span> <span className="text-ink-2">{t("des personnes présentes referaient un Moment ensemble")}</span></p>
            )}
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{t("Détail des notes")}</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {ratingCriteria.map((c) => {
                const v = rep.criteria[c.id];
                if (v === null || v === undefined) return null;
                return (
                  <li key={c.id} className="flex items-center justify-between rounded-2xl bg-surface-2/60 px-3 py-2 text-sm">
                    <span className="text-ink-2">{t(c.label)}</span>
                    <span className="font-semibold">{fmt(v)}</span>
                  </li>
                );
              })}
            </ul>
            {rep.badges.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {rep.badges.map((b) => <span key={b} className="pill bg-lilac/10 text-accent">{t(b)}</span>)}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">{t("La note s'affiche à partir de {n} avis.", { n: min })}</p>
        )}
        <p className="text-xs text-muted">{t("Les avis sont laissés par les personnes présentes, après chaque Moment. Ils restent anonymes.")}</p>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl">{t("Les Moments notés")}</h2>
        {r.moments.length === 0 ? (
          <p className="text-sm text-muted">{t("Aucun Moment noté pour l'instant.")}</p>
        ) : (
          <ul className="space-y-2">
            {r.moments.map((m) => (
              <li key={m.id}>
                <Link href={`/moments/${m.id}`} className="card flex items-center gap-3 p-2.5 hover:border-ink/30">
                  {m.mediaType === "IMAGE" && m.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.mediaUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
                  ) : (
                    <span className={`text-cover-${m.textTheme ?? "dusk"} h-14 w-14 shrink-0 rounded-xl`} aria-hidden />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.title}</span>
                    <span className="block truncate text-sm text-muted">
                      {new Date(m.startsAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric", timeZone: m.timezone })} · {m.city} · {t(m.asHost ? "Hôte" : "Participant")}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    {m.avg !== null ? (
                      <span className="flex items-center gap-1 font-semibold"><Star size={14} className="fill-current text-amber-400" /> {fmt(m.avg)}</span>
                    ) : null}
                    <span className="block text-xs text-muted">{t("{n} avis", { n: m.count })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {r.hidden > 0 && <p className="text-xs text-muted">{t("{n} autre(s) Moment(s) non affiché(s) pour respecter la vie privée.", { n: r.hidden })}</p>}
      </section>
    </div>
  );
}

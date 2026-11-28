import { tierLimits, tierOf } from "@/lib/premium";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CalendarHeart } from "lucide-react";
import { FeedFilters } from "@/components/FeedFilters";
import { getViewerSafe } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { utcToZonedLocal, zonedLocalToUtc } from "@/lib/time";
import { dayLabel } from "@/lib/availability-labels";
import { listAvailabilities, myAvailabilities } from "@/server/availability";
import { canSeeAdult } from "@/server/moments";
import { AvailabilityCard, MyAvailabilities } from "@/components/Availability";
import { PageTitle } from "@/components/States";
import { getLocale, getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Dispos");
export const dynamic = "force-dynamic";

type SP = Promise<{ city?: string; when?: string; near?: string; km?: string; creneau?: string; nouveau?: string; date?: string; slot?: string; cat?: string; area?: string; note?: string; ville?: string }>;

const whenOptions = [
  { id: "today", label: "Aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Ce week-end" },
  { id: "later", label: "Plus tard" },
];

export default async function DisposPage({ searchParams }: { searchParams: SP }) {
  if (!productConfig.features.availability) notFound();
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/dispos");
  const sp = await searchParams;
  const city = sp.city && productConfig.cities.includes(sp.city as never) ? sp.city : undefined;
  const when = whenOptions.some((w) => w.id === sp.when) ? sp.when || undefined : undefined;
  const t = await getT();
  const locale = await getLocale();
  const tz = productConfig.defaultTimezone;

  const mine = await myAvailabilities(viewer);
  const slotFilter = ["morning", "lunch", "afternoon", "evening"].includes(sp.creneau ?? "") ? sp.creneau : undefined;
  const near = sp.near && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(sp.near) ? sp.near : undefined;
  const km = near ? Math.min(50, Math.max(0.5, Number(sp.km) || 5)) : undefined;
  const others = (await listAvailabilities(viewer, { city, when, slot: slotFilter, near, km })).filter((a) => !a.isMine);

  // Jours proposés pour publier une dispo : aujourd'hui (s'il reste un créneau) et les 13 suivants.
  const now = new Date();
  const dates: { value: string; label: string }[] = [];
  for (let i = 0; i < productConfig.limits.availabilityDaysAhead; i++) {
    const d = new Date(now.getTime() + i * 86400_000);
    const value = utcToZonedLocal(d, tz).slice(0, 10);
    if (i === 0 && zonedLocalToUtc(`${value}T23:30`, tz) <= now) continue;
    dates.push({ value, label: dayLabel(zonedLocalToUtc(`${value}T12:00`, tz).toISOString(), tz, locale, t) });
  }


  return (
    <div className="space-y-6">
      <PageTitle eyebrow={t("Dispos")} title={t("Qui est libre ?")} />

      <MyAvailabilities
        initial={mine}
        defaultCity={viewer.city || productConfig.pilotCity}
        timezone={tz}
        dates={dates}
        showAdult={canSeeAdult(viewer)}
        tier={tierOf(viewer)}
        maxActive={tierLimits[tierOf(viewer)].activeAvailabilities}
        prefill={
          sp.nouveau
            ? { date: sp.date, slot: sp.slot, city: sp.ville, area: sp.area, categories: sp.cat ? sp.cat.split(",").filter(Boolean) : [], note: sp.note }
            : null
        }
      />

      <section aria-labelledby="others-title" className="space-y-4">
        <h2 id="others-title" className="sr-only">{t("Les dispos des autres")}</h2>
        <Suspense>
          <FeedFilters showCategories={false} showSlots />
        </Suspense>

        {others.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-lilac/10 text-accent">
              <CalendarHeart size={26} />
            </span>
            <h3 className="font-display text-xl">{near ? t("Personne n'est dispo dans ce rayon pour l'instant") : t("Personne n'a encore publié de dispo ici")}</h3>
            <p className="mt-2 max-w-sm text-sm text-muted">{t("Sois le premier à dire quand tu es libre, ou crée directement un Moment : il suffit d'une idée et de quelques places.")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {(city || when || near || slotFilter) && <Link href="/dispos" className="btn-secondary">{t("Voir toutes les dispos")}</Link>}
              <Link href="/moments/nouveau" className="btn-primary">{t("Créer un Moment")}</Link>
            </div>
          </div>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {others.map((a) => (
              <li key={a.id} className="flex min-w-0">
                <div className="min-w-0 flex-1 [&>article]:h-full">
                  <AvailabilityCard a={a} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}

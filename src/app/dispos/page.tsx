import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CalendarHeart, ShieldCheck } from "lucide-react";
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

type SP = Promise<{ city?: string; when?: string; nouveau?: string; date?: string; slot?: string; cat?: string; area?: string; note?: string; ville?: string }>;

const whenOptions = [
  { id: "", label: "À venir" },
  { id: "today", label: "Aujourd'hui" },
  { id: "tomorrow", label: "Demain" },
  { id: "weekend", label: "Ce week-end" },
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
  const others = (await listAvailabilities(viewer, { city, when })).filter((a) => !a.isMine);

  // Jours proposés pour publier une dispo : aujourd'hui (s'il reste un créneau) et les 13 suivants.
  const now = new Date();
  const dates: { value: string; label: string }[] = [];
  for (let i = 0; i < productConfig.limits.availabilityDaysAhead; i++) {
    const d = new Date(now.getTime() + i * 86400_000);
    const value = utcToZonedLocal(d, tz).slice(0, 10);
    if (i === 0 && zonedLocalToUtc(`${value}T23:30`, tz) <= now) continue;
    dates.push({ value, label: dayLabel(zonedLocalToUtc(`${value}T12:00`, tz).toISOString(), tz, locale, t) });
  }

  // Regroupement par jour.
  const groups = new Map<string, typeof others>();
  for (const a of others) {
    const key = a.date;
    groups.set(key, [...(groups.get(key) ?? []), a]);
  }
  const q = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { city, when, ...over };
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    return `/dispos${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <PageTitle eyebrow={t("Dispos")} title={t("Qui est libre bientôt ?")} />
      <p className="-mt-3 max-w-2xl text-ink-2">
        {t("Des membres ont dit quand ils sont libres. Une envie en commun ? Propose-leur un Moment : ils reçoivent une invitation et choisissent librement.")}
      </p>

      <MyAvailabilities
        initial={mine}
        defaultCity={viewer.city || productConfig.pilotCity}
        timezone={tz}
        dates={dates}
        showAdult={canSeeAdult(viewer)}
        prefill={
          sp.nouveau
            ? { date: sp.date, slot: sp.slot, city: sp.ville, area: sp.area, categories: sp.cat ? sp.cat.split(",").filter(Boolean) : [], note: sp.note }
            : null
        }
      />

      <section aria-labelledby="others-title" className="space-y-4">
        <h2 id="others-title" className="font-display text-2xl">{t("Les dispos des autres")}</h2>
        <div className="flex flex-wrap gap-2">
          <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("Quand")}>
            {whenOptions.map((o) => (
              <Link key={o.id} href={q({ when: o.id || undefined })} aria-current={(when ?? "") === o.id ? "true" : undefined} className={`chip shrink-0 ${(when ?? "") === o.id ? "chip-active" : ""}`}>
                {t(o.label)}
              </Link>
            ))}
          </div>
          <div className="scroll-row -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label={t("Ville")}>
            <Link href={q({ city: undefined })} aria-current={!city ? "true" : undefined} className={`chip shrink-0 ${!city ? "chip-active" : ""}`}>{t("Toutes les villes")}</Link>
            {productConfig.cities.map((c) => (
              <Link key={c} href={q({ city: c })} aria-current={city === c ? "true" : undefined} className={`chip shrink-0 ${city === c ? "chip-active" : ""}`}>{c}</Link>
            ))}
          </div>
        </div>

        {others.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-12 text-center">
            <span className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-lilac/10 text-accent">
              <CalendarHeart size={26} />
            </span>
            <h3 className="font-display text-xl">{t("Personne n'a encore publié de dispo ici")}</h3>
            <p className="mt-2 max-w-sm text-sm text-muted">{t("Sois le premier à dire quand tu es libre, ou crée directement un Moment : il suffit d'une idée et de quelques places.")}</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {(city || when) && <Link href="/dispos" className="btn-secondary">{t("Voir toutes les dispos")}</Link>}
              <Link href="/moments/nouveau" className="btn-primary">{t("Créer un Moment")}</Link>
            </div>
          </div>
        ) : (
          [...groups.entries()].map(([day, list]) => (
            <div key={day} className="space-y-3">
              <h3 className="eyebrow">{dayLabel(list[0].startsAt, list[0].timezone, locale, t)}</h3>
              <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((a) => (
                  <li key={a.id} className="flex">
                    <div className="flex-1 [&>article]:h-full">
                      <AvailabilityCard a={a} />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>

      <p className="flex items-start gap-2 text-sm text-muted">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
        {t("Seuls les membres connectés voient les dispos. Jamais d'adresse : la ville et le quartier suffisent. Les personnes bloquées ne voient pas les tiennes.")}
      </p>
    </div>
  );
}

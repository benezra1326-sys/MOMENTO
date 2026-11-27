import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, CalendarHeart, Compass } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productConfig } from "@/config/product";
import { loadFeed } from "@/server/loaders";
import { FeedFilters } from "@/components/FeedFilters";
import { FeedList } from "@/components/FeedList";
import { OfflineDemoNotice } from "@/components/States";
import { getT } from "@/lib/i18n/server";
import { listAvailabilities, type AvailabilityDTO } from "@/server/availability";
import { AvailabilityCard } from "@/components/Availability";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function flat(sp: Awaited<SP>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) out[k] = v;
  return out;
}

export default async function FeedPage({ searchParams }: { searchParams: SP }) {
  const viewer = await getViewerSafe();
  const t = await getT();
  const query = flat(await searchParams);
  delete query.cursor;
  const feed = await loadFeed(viewer, query);
  const autoplay = viewer
    ? (await prisma.user.findUnique({ where: { id: viewer.id }, select: { autoplayVideos: true } }).catch(() => null))?.autoplayVideos ?? true
    : true;

  // Deuxième porte d'entrée vers les Moments : quelques personnes libres bientôt.
  let dispos: AvailabilityDTO[] = [];
  if (viewer && productConfig.features.availability && feed.source === "database") {
    dispos = (await listAvailabilities(viewer, { city: query.city, when: query.when === "week" ? undefined : query.when }).catch(() => []))
      .filter((a) => !a.isMine)
      .slice(0, 8);
  }

  return (
    <div className="space-y-6">
      {!viewer ? (
        <section className="relative overflow-hidden rounded-[2rem] border border-border bg-surface px-6 py-7 text-white sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-coral/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-accent/40 blur-3xl" />
          <p className="eyebrow relative !text-white/60">{t(productConfig.tagline)}</p>
          <h1 className="font-display relative mt-3 max-w-2xl text-[clamp(2.1rem,6vw,3.6rem)] leading-[1.02]">
            {t("Moins de scroll.")}<br />{t("Plus de moments vécus.")}
          </h1>
          <p className="relative mt-3 max-w-xl text-[15px] text-white/75 sm:mt-4 sm:text-base">
            {t("Découvre un Moment près de toi, demande à le rejoindre ou crée le tien. L'hôte accepte, et vous vous retrouvez pour de vrai.")}
          </p>
          <div className="relative mt-5 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3">
            <Link href="/inscription" className="bg-cream text-night hover:bg-white inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold">
              {t("Créer mon compte")} <ArrowRight size={18} />
            </Link>
            <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-5 font-semibold text-white hover:bg-white/10">
              {t("J'ai déjà un compte")}
            </Link>
          </div>
        </section>
      ) : (
        <header>
          <p className="eyebrow">{t("Bonjour {name}", { name: viewer.name.split(" ")[0] })}</p>
          <h1 className="font-display mt-1 text-[clamp(1.9rem,5vw,2.8rem)] leading-tight">
            {query.when === "weekend" ? t("Qu'est-ce qu'on vit ce week-end ?") : t("Qu'est-ce qu'on vit bientôt ?")}
          </h1>
        </header>
      )}

      {feed.source === "demo-fallback" && <OfflineDemoNotice />}

      <Suspense>
        <FeedFilters />
      </Suspense>

      {viewer && productConfig.features.availability && (
        <section aria-labelledby="dispos-strip" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="dispos-strip" className="flex items-center gap-2 font-display text-xl">
                <CalendarHeart size={20} className="text-primary" aria-hidden /> {t("Libres bientôt")}
              </h2>
              <p className="text-sm text-muted">{t("Une idée ? Propose-leur un Moment.")}</p>
            </div>
            <Link href="/dispos" className="shrink-0 text-sm font-semibold text-accent underline-offset-2 hover:underline">
              {dispos.length > 0 ? t("Tout voir") : t("Je suis dispo")}
            </Link>
          </div>
          {dispos.length > 0 ? (
            <ul className="scroll-row -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
              {dispos.map((a) => (
                <li key={a.id} className="flex">
                  <AvailabilityCard a={a} compact />
                </li>
              ))}
            </ul>
          ) : (
            <Link href="/dispos" className="card flex items-center gap-3 p-4 text-sm hover:bg-surface-2/60">
              <CalendarHeart size={20} className="shrink-0 text-accent" aria-hidden />
              <span>{t("Personne n'a publié de dispo pour ces filtres. Dis quand tu es libre : quelqu'un pourra te proposer un Moment.")}</span>
            </Link>
          )}
        </section>
      )}

      <div className="flex items-center justify-between gap-3 lg:hidden">
        <h2 className="font-display text-xl">{t("Les Moments")}</h2>
        <Link href="/explorer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent">
          <Compass size={15} aria-hidden /> {t("Explorer")}
        </Link>
      </div>

      <FeedList key={JSON.stringify(query)} initial={feed} query={new URLSearchParams(query).toString()} autoplay={autoplay} signedIn={!!viewer} />
    </div>
  );
}

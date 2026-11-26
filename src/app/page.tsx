import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { productConfig } from "@/config/product";
import { loadFeed } from "@/server/loaders";
import { FeedFilters } from "@/components/FeedFilters";
import { FeedList } from "@/components/FeedList";
import { OfflineDemoNotice } from "@/components/States";

export const dynamic = "force-dynamic";

type SP = Promise<Record<string, string | string[] | undefined>>;

function flat(sp: Awaited<SP>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) out[k] = v;
  return out;
}

export default async function FeedPage({ searchParams }: { searchParams: SP }) {
  const viewer = await getViewerSafe();
  const query = flat(await searchParams);
  delete query.cursor;
  const feed = await loadFeed(viewer, query);
  const autoplay = viewer
    ? (await prisma.user.findUnique({ where: { id: viewer.id }, select: { autoplayVideos: true } }).catch(() => null))?.autoplayVideos ?? true
    : true;

  return (
    <div className="space-y-6">
      {!viewer ? (
        <section className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-7 text-white sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-10 h-72 w-72 rounded-full bg-violet/40 blur-3xl" />
          <p className="eyebrow relative !text-white/60">{productConfig.mantra}</p>
          <h1 className="font-display relative mt-3 max-w-2xl text-[clamp(2.1rem,6vw,3.6rem)] leading-[1.02]">
            Moins de scroll.<br />Plus de moments vécus.
          </h1>
          <p className="relative mt-3 max-w-xl text-[15px] text-white/75 sm:mt-4 sm:text-base">
            Découvre un Moment près de toi, demande à le rejoindre ou crée le tien. L&apos;hôte accepte, et vous vous retrouvez pour de vrai.
          </p>
          <div className="relative mt-5 flex flex-wrap gap-2.5 sm:mt-7 sm:gap-3">
            <Link href="/inscription" className="bg-white text-ink hover:bg-cream inline-flex min-h-11 items-center gap-2 rounded-full px-5 font-semibold">
              Créer mon compte <ArrowRight size={18} />
            </Link>
            <Link href="/connexion" className="inline-flex min-h-11 items-center rounded-full border border-white/25 px-5 font-semibold text-white hover:bg-white/10">
              J&apos;ai déjà un compte
            </Link>
          </div>
        </section>
      ) : (
        <header>
          <p className="eyebrow">Bonjour {viewer.name.split(" ")[0]}</p>
          <h1 className="font-display mt-1 text-[clamp(1.9rem,5vw,2.8rem)] leading-tight">
            Qu&apos;est-ce qu&apos;on vit {query.when === "weekend" ? "ce week-end" : "bientôt"} ?
          </h1>
        </header>
      )}

      {feed.source === "demo-fallback" && <OfflineDemoNotice />}

      <Suspense>
        <FeedFilters />
      </Suspense>

      <FeedList key={JSON.stringify(query)} initial={feed} query={new URLSearchParams(query).toString()} autoplay={autoplay} signedIn={!!viewer} />
    </div>
  );
}

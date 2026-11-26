import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { categories, productConfig } from "@/config/product";
import { PageTitle } from "@/components/States";

export const metadata = { title: "Explorer" };
export const dynamic = "force-dynamic";

const covers: Record<string, string> = {
  dinner: "dinner-1", drinks: "drinks-1", sunset: "sunset-2", coffee: "coffee-1", brunch: "brunch-1",
  gallery: "gallery-1", walk: "walk-1", sport: "sport-1", party: "party-1", boat: "boat-1", other: "other-1",
};

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ city?: string }> }) {
  const { city } = await searchParams;
  const counts = await prisma.moment
    .groupBy({
      by: ["category"],
      where: {
        status: "PUBLISHED",
        visibility: { in: ["PUBLIC", "REQUEST"] },
        startsAt: { gte: new Date() },
        ...(city ? { city: { equals: city, mode: "insensitive" } } : {}),
      },
      _count: { _all: true },
    })
    .catch(() => []);
  const byCat = new Map(counts.map((c) => [c.category, c._count._all]));
  const q = (cat: string) => `/?${new URLSearchParams({ category: cat, ...(city ? { city } : {}) })}`;

  return (
    <>
      <PageTitle eyebrow="Explorer" title="Trouve ton prochain Moment" />
      <div className="scroll-row -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Ville">
        <Link href="/explorer" className={`chip ${!city ? "chip-active" : ""}`}>Partout</Link>
        {productConfig.cities.map((c) => (
          <Link key={c} href={`/explorer?city=${encodeURIComponent(c)}`} className={`chip ${city === c ? "chip-active" : ""}`}>{c}</Link>
        ))}
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((c) => {
          const n = byCat.get(c.id) ?? 0;
          return (
            <li key={c.id}>
              <Link href={q(c.id)} className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-ink">
                <Image src={`/demo/moments/${covers[c.id]}.webp`} alt="" fill sizes="(min-width: 1024px) 22vw, 45vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
                <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <span className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <span className="font-display block text-2xl leading-tight">{c.label}</span>
                  <span className="text-sm text-white/80">{n === 0 ? "Aucun pour l'instant" : `${n} à venir`}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getViewerSafe } from "@/lib/auth";
import { RateFlow } from "@/components/RateFlow";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Noter le Moment");
export const dynamic = "force-dynamic";

/** Notation après un Moment : étoiles, qualités en un geste, « tu le referais ? », commentaire facultatif. */
export default async function RateMomentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ etoiles?: string }> }) {
  const { id } = await params;
  const { etoiles } = await searchParams;
  const viewer = await getViewerSafe();
  if (!viewer) redirect(`/connexion?suite=/moments/${id}/noter`);
  const m = await prisma.moment.findUnique({ where: { id }, select: { id: true, title: true, mediaType: true, mediaUrl: true, posterUrl: true, textTheme: true } });
  if (!m) notFound();
  const stars = Number(etoiles);
  return (
    <RateFlow
      momentId={m.id}
      title={m.title}
      initialStars={Number.isInteger(stars) && stars >= 1 && stars <= 5 ? stars : undefined}
      cover={{ mediaUrl: m.mediaType === "IMAGE" ? m.mediaUrl : m.posterUrl, textTheme: m.textTheme }}
    />
  );
}

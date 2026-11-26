import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { getMyProfile, getPublicProfile } from "@/server/accounts";
import { listMyBlocks } from "@/server/safety";
import { ProfileHeader, ProfileMoments } from "@/components/ProfileHeader";
import { ProfileSettings } from "@/components/ProfileSettings";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Mon profil");
export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/moi");
  const { bienvenue } = await searchParams;
  const t = await getT();
  const [me, profile, blocks] = await Promise.all([getMyProfile(viewer), getPublicProfile(viewer, viewer.username), listMyBlocks(viewer)]);
  return (
    <div className="space-y-8">
      <ProfileHeader p={profile}>
        <Link href={`/u/${viewer.username}`} className="btn-secondary">{t("Voir mon profil public")}</Link>
      </ProfileHeader>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ProfileMoments p={profile} narrow />
        <ProfileSettings me={me} blocks={blocks} welcome={bienvenue === "1"} />
      </div>
    </div>
  );
}

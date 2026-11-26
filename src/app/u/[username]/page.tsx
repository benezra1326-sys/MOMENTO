import { notFound } from "next/navigation";
import Link from "next/link";
import { getViewerSafe } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { getPublicProfile } from "@/server/accounts";
import { ProfileHeader, ProfileMoments } from "@/components/ProfileHeader";
import { SafetyActions } from "@/components/SafetyActions";
import { EmptyState } from "@/components/States";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function PublicProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const viewer = await getViewerSafe();
  const t = await getT();
  let p;
  try {
    p = await getPublicProfile(viewer, username);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  if (p.suspended) return <EmptyState icon="lock" title={t("Compte suspendu")} text={t("Ce profil n'est plus visible.")} action={{ href: "/", label: t("Retour au feed") }} />;
  return (
    <div className="space-y-8">
      <ProfileHeader p={p}>
        {p.isSelf && <Link href="/moi" className="btn-secondary">{t("Modifier mon profil")}</Link>}
      </ProfileHeader>
      <ProfileMoments p={p} />
      {viewer && !p.isSelf && (
        <div className="border-t border-line pt-4">
          <SafetyActions username={p.username} blocked={p.viewerBlocked} label={t("ce profil")} />
        </div>
      )}
    </div>
  );
}

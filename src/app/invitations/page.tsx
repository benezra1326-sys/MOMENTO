import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { myInvitations } from "@/server/memberships";
import { InvitationsView, type InvitationsData } from "@/components/InvitationsView";
import { PageTitle } from "@/components/States";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Invitations");
export const dynamic = "force-dynamic";

export default async function InvitationsPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/invitations");
  const { onglet } = await searchParams;
  const t = await getT();
  const data = (await myInvitations(viewer)) as InvitationsData;
  return (
    <>
      <PageTitle eyebrow={t("Demandes & invitations")} title={t("Tes Moments à venir")} />
      <InvitationsView data={data} initialTab={onglet} />
    </>
  );
}

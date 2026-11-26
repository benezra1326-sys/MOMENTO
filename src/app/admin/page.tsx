import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { listReports } from "@/server/safety";
import { AdminReports } from "@/components/AdminReports";
import { EmptyState, PageTitle } from "@/components/States";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Modération");
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/admin");
  const t = await getT();
  if (viewer.role !== "ADMIN") return <EmptyState icon="lock" title={t("Accès refusé")} text={t("Cet espace est réservé à l'équipe de modération.")} />;
  const { statut } = await searchParams;
  const status = statut === "traites" ? "RESOLVED" : "OPEN";
  const reports = await listReports(viewer, status);
  return (
    <>
      <PageTitle eyebrow={t("Modération")} title={t("Signalements")} />
      <AdminReports reports={reports} status={status} />
    </>
  );
}

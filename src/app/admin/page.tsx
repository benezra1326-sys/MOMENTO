import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { listReports } from "@/server/safety";
import { AdminReports } from "@/components/AdminReports";
import { EmptyState, PageTitle } from "@/components/States";

export const metadata = { title: "Modération" };
export const dynamic = "force-dynamic";

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ statut?: string }> }) {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/admin");
  if (viewer.role !== "ADMIN") return <EmptyState icon="lock" title="Accès refusé" text="Cet espace est réservé à l'équipe de modération." />;
  const { statut } = await searchParams;
  const status = statut === "traites" ? "RESOLVED" : "OPEN";
  const reports = await listReports(viewer, status);
  return (
    <>
      <PageTitle eyebrow="Modération" title="Signalements" />
      <AdminReports reports={reports} status={status} />
    </>
  );
}

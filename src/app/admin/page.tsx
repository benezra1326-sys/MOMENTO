import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { listReports } from "@/server/safety";
import { AdminReports } from "@/components/AdminReports";
import { AdminVerifications } from "@/components/AdminVerifications";
import { pendingVerifications } from "@/server/verification";
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
  const verifications = await pendingVerifications(viewer);
  return (
    <>
      <section className="mb-10 space-y-3">
        <h2 className="font-display text-2xl">{t("Photos à certifier")} {verifications.length > 0 && <span className="pill bg-accent/15 align-middle text-sm">{verifications.length}</span>}</h2>
        <AdminVerifications items={verifications} />
      </section>
      <PageTitle eyebrow={t("Modération")} title={t("Signalements")} />
      <AdminReports reports={reports} status={status} />
    </>
  );
}

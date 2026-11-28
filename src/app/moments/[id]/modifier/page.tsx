import { tierOf } from "@/lib/premium";
import { notFound, redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { canSeeAdult, getMomentForEdit } from "@/server/moments";
import { productConfig } from "@/config/product";
import { MomentForm } from "@/components/MomentForm";
import { EmptyState, PageTitle } from "@/components/States";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Modifier le Moment");
export const dynamic = "force-dynamic";

export default async function EditMomentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewerSafe();
  const t = await getT();
  if (!viewer) redirect(`/connexion?suite=/moments/${id}/modifier`);
  let data;
  try {
    data = await getMomentForEdit(viewer, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    if (e instanceof AppError && e.code === "FORBIDDEN") {
      return <EmptyState icon="lock" title={t("Accès refusé")} text={t("Seul l'hôte peut modifier ce Moment.")} action={{ href: `/moments/${id}`, label: t("Voir le Moment") }} />;
    }
    throw e;
  }
  if (data.status === "CANCELLED") {
    return <EmptyState title={t("Moment annulé")} text={t("Un Moment annulé ne peut plus être modifié.")} action={{ href: `/moments/${id}`, label: t("Voir le Moment") }} />;
  }
  const { id: _id, status, ...values } = data;
  void _id;
  return (
    <>
      <PageTitle eyebrow={t("Modifier")} title={data.title} />
      <MomentForm
        mode="edit"
        momentId={id}
        status={status}
        host={{ id: viewer.id, name: viewer.name, username: viewer.username, photoUrl: viewer.photoUrl, isDemo: viewer.isDemo }}
        showAdult={canSeeAdult(viewer)}
        canBlackOnly={tierOf(viewer) === "black"}
        memberVideos={productConfig.features.memberVideos}
        initial={{ ...values, address: values.address ?? "", endsAtLocal: values.endsAtLocal ?? "" }}
      />
    </>
  );
}

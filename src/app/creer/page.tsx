import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { productConfig } from "@/config/product";
import { CreateChooser } from "@/components/CreateChooser";
import { PageTitle } from "@/components/States";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Créer");
export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/creer");
  const t = await getT();
  return (
    <>
      <PageTitle eyebrow={t("Créer")} title={t("Qu'est-ce qui te ferait plaisir ?")} />
      <CreateChooser availability={productConfig.features.availability} />
    </>
  );
}

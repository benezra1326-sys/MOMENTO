import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { getMyProfile } from "@/server/accounts";
import { myVerification } from "@/server/verification";
import { SelfieCertification } from "@/components/SelfieCertification";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Certifier ma photo");
export const dynamic = "force-dynamic";

export default async function CertificationPage() {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/moi/certification");
  // Requêtes séquentielles : une seule connexion à la base en production.
  const me = await getMyProfile(viewer);
  const state = await myVerification(viewer);
  return <SelfieCertification me={{ name: me.name, username: me.username, photoUrl: me.photoUrl }} initial={state} />;
}

import { EmptyState } from "@/components/States";
import { getT } from "@/lib/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto mt-6 max-w-lg">
      <EmptyState title={t("Page introuvable")} text={t("Ce Moment ou ce profil n'existe pas, ou n'est plus disponible.")} action={{ href: "/", label: t("Retour au feed") }} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Eye, Users } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { myInvitations } from "@/server/memberships";
import { momentsToRate } from "@/server/ratings";
import { RatePrompt } from "@/components/RateFlow";
import { InvitationsView, type InvitationsData } from "@/components/InvitationsView";
import { PageTitle } from "@/components/States";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Activité");
export const dynamic = "force-dynamic";

/** Activité : l'agenda (à venir, demandes, invitations), les Moments à noter et les notifications. */
export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/activite");
  const { onglet } = await searchParams;
  const t = await getT();
  // Requêtes séquentielles : une seule connexion à la base en production.
  const data = (await myInvitations(viewer)) as InvitationsData;
  const toRate = await momentsToRate(viewer).catch(() => []);
  return (
    <>
      <PageTitle eyebrow={t("Ton agenda")} title={t("Activité")} />
      {toRate.length > 0 && <div className="mb-6 space-y-3">
        {toRate.map((m) => <RatePrompt key={m.id} item={m} compact />)}
      </div>}
      <div className="mb-6 grid gap-2 sm:grid-cols-2">
        <Link href="/vues" className="card flex items-center gap-3 px-4 py-3 text-sm">
          <Eye size={18} className="text-accent" /> <span className="flex-1">{t("Qui a vu tes Moments et ton profil")}</span> <ChevronRight size={16} className="text-muted" />
        </Link>
        <Link href="/personnes" className="card flex items-center gap-3 px-4 py-3 text-sm">
          <Users size={18} className="text-accent" /> <span className="flex-1">{t("Personnes pour toi")}</span> <ChevronRight size={16} className="text-muted" />
        </Link>
      </div>
      <InvitationsView data={data} initialTab={onglet} />
    </>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell, ChevronRight, Star } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { myInvitations } from "@/server/memberships";
import { momentsToRate } from "@/server/ratings";
import { unreadCount } from "@/server/notifications";
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
  const unread = await unreadCount(viewer.id).catch(() => 0);
  return (
    <>
      <PageTitle eyebrow={t("Ton agenda")} title={t("Activité")} />
      <div className="mb-6 space-y-3">
        <Link href="/notifications" className="card flex items-center gap-3 px-4 py-3">
          <Bell size={18} className="text-muted" />
          <span className="flex-1 font-medium">{t("Notifications")}</span>
          {unread > 0 && <span className="rounded-full bg-coral px-2 text-xs font-semibold text-night">{unread}</span>}
          <ChevronRight size={18} className="text-muted" />
        </Link>
        {toRate.map((m) => (
          <Link key={m.id} href={`/moments/${m.id}#noter`} className="card flex items-center gap-3 border-accent/30 px-4 py-3">
            <Star size={18} className="text-amber-400" />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t("Note « {x} »", { x: m.title })}</span>
              <span className="text-sm text-muted">{t("Tes notes sont privées. Elles aident à mettre en avant les meilleurs hôtes.")}</span>
            </span>
            <ChevronRight size={18} className="text-muted" />
          </Link>
        ))}
      </div>
      <InvitationsView data={data} initialTab={onglet} />
    </>
  );
}

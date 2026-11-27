import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { listNotifications, markAllRead } from "@/server/notifications";
import { formatRelative } from "@/lib/time";
import { getLocale } from "@/lib/i18n/server";
import { PageTitle } from "@/components/States";
import { Avatar } from "@/components/Avatar";
import { localizeNotification } from "@/lib/i18n/notifications";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Notifications");
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/notifications");
  const items = await listNotifications(viewer);
  const t = await getT();
  const locale = await getLocale();
  // Ouvrir la page vaut lecture : le point rouge disparaît à la prochaine navigation.
  if (items.some((n) => !n.read)) await markAllRead(viewer);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow={t("Activité")} title={t("Notifications")} />
      {items.length === 0 ? (
        <div className="card flex flex-col items-center px-6 py-12 text-center">
          <Bell className="mb-3 text-muted" />
          <p className="text-muted">{t("Rien de nouveau. Les réponses à tes demandes et les invitations arriveront ici.")}</p>
        </div>
      ) : (
        <ul className="card divide-y divide-line">
          {items.map((n) => {
            const body = (
              <div className="flex items-start gap-3 px-5 py-4">
                <span className={`mt-4 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-rose"}`} aria-hidden />
                {n.actor ? <Avatar person={n.actor} size="md" /> : <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand text-muted"><Bell size={18} aria-hidden /></span>}
                <div className="min-w-0 pt-0.5">
                  <p className={n.read ? "text-ink-soft" : "font-medium"}>{localizeNotification(n.body, locale)}</p>
                  <p className="mt-0.5 text-xs text-muted">{formatRelative(n.createdAt, locale)}</p>
                </div>
              </div>
            );
            return <li key={n.id}>{n.momentId ? <Link href={`/moments/${n.momentId}`} className="block hover:bg-sand/40">{body}</Link> : body}</li>;
          })}
        </ul>
      )}
      <p className="mt-4 text-center text-xs text-muted">{t("Momento n'envoie aucune notification promotionnelle.")}</p>
    </div>
  );
}

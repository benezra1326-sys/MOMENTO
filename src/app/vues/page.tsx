import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, Eye } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { myViews } from "@/server/black";
import { Avatar } from "@/components/Avatar";
import { PageTitle } from "@/components/States";
import { formatRelative } from "@/lib/time";
import { getLocale, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Qui a vu");
export const dynamic = "force-dynamic";

/** Upclose Black : qui a vu ton profil et tes Moments ces 30 derniers jours. */
export default async function ViewsPage() {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/vues");
  const locale = await getLocale();
  const v = await myViews(viewer);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Upclose Black" title="Qui a vu tes Moments et ton profil" />
      {!v.unlocked ? (
        <section className="card space-y-4 p-6 text-center">
          <Eye size={32} className="mx-auto text-accent" />
          <p className="font-display text-2xl">{v.people > 0 ? `${v.people} personne${v.people > 1 ? "s" : ""} ces 30 derniers jours` : "Personne pour l'instant"}</p>
          <p className="text-ink-2">Avec Upclose Black, tu vois qui a regardé ton profil et tes Moments.</p>
          <Link href="/premium?retour=%2Fvues" className="btn-primary"><Crown size={16} /> Découvrir Upclose Black</Link>
        </section>
      ) : v.rows.length === 0 ? (
        <p className="card p-6 text-center text-muted">Personne ces 30 derniers jours. Publie un Moment pour te faire connaître.</p>
      ) : (
        <ul className="card divide-y divide-border/60">
          {v.rows.map((r) => (
            <li key={r.person.id} className="flex items-center gap-3 p-4">
              <Link href={`/u/${r.person.username}`}><Avatar person={r.person} size="md" /></Link>
              <div className="min-w-0 flex-1">
                <Link href={`/u/${r.person.username}`} className="block truncate font-semibold hover:underline">{r.person.name}</Link>
                <p className="truncate text-sm text-muted">
                  {[r.profile ? "ton profil" : null, ...r.moments.map((m) => `« ${m.title} »`)].filter(Boolean).join(", ")}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted">{formatRelative(r.lastAt, locale)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

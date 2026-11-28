import Link from "next/link";
import { redirect } from "next/navigation";
import { Crown, Users } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { suggestPeople } from "@/server/black";
import { Avatar } from "@/components/Avatar";
import { PageTitle } from "@/components/States";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Personnes pour toi");
export const dynamic = "force-dynamic";

/** Upclose Black : des personnes à inviter, avec la raison de chaque suggestion. */
export default async function PeoplePage() {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/personnes");
  const s = await suggestPeople(viewer);
  return (
    <div className="mx-auto max-w-2xl">
      <PageTitle eyebrow="Upclose Black" title="Personnes pour toi" />
      {!s.unlocked ? (
        <section className="card space-y-4 p-6 text-center">
          <Users size={32} className="mx-auto text-accent" />
          <p className="text-ink-2">Avec Upclose Black, Upclose te propose des personnes qui partagent tes envies, dans ta ville, avec la raison de chaque suggestion.</p>
          <Link href="/premium?retour=%2Fpersonnes" className="btn-primary"><Crown size={16} /> Découvrir Upclose Black</Link>
        </section>
      ) : s.items.length === 0 ? (
        <p className="card p-6 text-center text-muted">Ajoute tes centres d&apos;intérêt et ta ville dans ton profil pour recevoir des suggestions.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {s.items.map((x) => (
            <li key={x.person.id} className="card flex gap-3 p-4">
              <Link href={`/u/${x.person.username}`}><Avatar person={x.person} size="md" /></Link>
              <div className="min-w-0">
                <Link href={`/u/${x.person.username}`} className="block truncate font-semibold hover:underline">{x.person.name}</Link>
                <ul className="mt-1 space-y-0.5 text-sm text-muted">
                  {x.reasons.map((r) => <li key={r}>· {r}</li>)}
                </ul>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

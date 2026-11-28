import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Minus, Sparkles } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { getBilling, safeReturn } from "@/server/billing";
import { planFeatures, premiumPlan } from "@/lib/premium";
import { PremiumActions } from "@/components/PremiumActions";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Upclose+");
export const dynamic = "force-dynamic";

function Cell({ v }: { v: string | boolean }) {
  if (v === true) return <Check size={18} className="mx-auto text-success" aria-label="Inclus" />;
  if (v === false) return <Minus size={18} className="mx-auto text-muted" aria-label="Non inclus" />;
  return <span>{v}</span>;
}

export default async function PremiumPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const retour = safeReturn((await searchParams).retour);
  const viewer = await getViewerSafe();
  if (!viewer) redirect(`/connexion?suite=${encodeURIComponent(`/premium${retour ? `?retour=${retour}` : ""}`)}`);
  const b = await getBilling(viewer);
  const until = b.until ? new Date(b.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long" }) : null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card space-y-4 p-5 sm:p-7">
        <p className="pill w-fit bg-accent/15 text-ink"><Sparkles size={14} /> {premiumPlan.name}</p>
        <h1 className="font-display text-3xl">{b.premium ? "Tu es membre Upclose+" : "Plus de Moments, plus de visibilité"}</h1>
        <p className="text-ink-2">
          {b.premium
            ? `Actif jusqu'au ${until}${b.cancelAt ? "" : ", renouvelé automatiquement"}.`
            : `${premiumPlan.priceLabel} par mois, sans engagement. Rejoindre des Moments reste gratuit, pour tout le monde.`}
        </p>
        {b.provider === "off" && !b.premium ? (
          <p className="rounded-2xl bg-surface-2/70 px-4 py-3 text-sm text-muted">L&apos;abonnement ouvre bientôt. Tout ce qui est gratuit reste ouvert.</p>
        ) : (
          <PremiumActions premium={b.premium} cancelAt={b.cancelAt} source={b.source} returnTo={retour} />
        )}
        {!b.premium && b.provider === "simulated" && (
          <p className="rounded-2xl bg-surface-2/70 px-4 py-3 text-sm text-muted">Mode recette : paiement simulé, aucun débit.</p>
        )}
        {!b.premium && b.provider === "stripe-test" && (
          <p className="rounded-2xl bg-surface-2/70 px-4 py-3 text-sm text-muted">
            Mode test Stripe : aucun vrai débit. Carte <span className="font-mono text-ink-2">4242 4242 4242 4242</span>, date future, n&apos;importe quel code.
          </p>
        )}
        {!b.premium && b.provider !== "off" && (
          <Link href={retour ?? "/"} className="block text-sm text-muted underline-offset-2 hover:underline">Continuer gratuitement</Link>
        )}
      </section>

      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              <th className="p-4 font-medium text-muted">Ce que tu peux faire</th>
              <th className="w-24 p-4 text-center font-medium">Gratuit</th>
              <th className="w-24 p-4 text-center font-medium text-accent">Upclose+</th>
            </tr>
          </thead>
          <tbody>
            {planFeatures.map((f) => (
              <tr key={f.label} className="border-b border-border/40 last:border-0">
                <td className="p-4 text-ink-2">{f.label}</td>
                <td className="p-4 text-center text-muted"><Cell v={f.free} /></td>
                <td className="p-4 text-center font-medium"><Cell v={f.plus} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="text-center text-sm text-muted">
        <Link href="/moi" className="underline-offset-2 hover:underline">Retour à mon profil</Link>
      </p>
    </div>
  );
}

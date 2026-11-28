import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { getViewerSafe } from "@/lib/auth";
import { getBilling, safeReturn } from "@/server/billing";
import { planFeatures, plans } from "@/lib/premium";
import { PremiumPlans } from "@/components/PremiumActions";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Offres");
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
  const until = b.until ? new Date(b.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card space-y-5 p-5 sm:p-7">
        <h1 className="font-display text-3xl">{b.tier === "free" ? "Plus de Moments, plus de rencontres" : `Tu es membre ${plans[b.tier].name}`}</h1>
        <p className="text-ink-2">
          {b.tier !== "free"
            ? `Actif jusqu'au ${until}${b.cancelAt ? "" : ", renouvelé automatiquement"}.`
            : "Sans engagement. Rejoindre des Moments, discuter et rester en sécurité reste gratuit pour tout le monde."}
        </p>
        {b.provider === "off" && b.tier === "free" ? (
          <p className="rounded-2xl bg-surface-2/70 px-4 py-3 text-sm text-muted">Les abonnements ouvrent bientôt. Tout ce qui est gratuit reste ouvert.</p>
        ) : (
          <PremiumPlans tier={b.tier} cancelAt={b.cancelAt} source={b.source} returnTo={retour} />
        )}
        {b.tier === "free" && b.provider === "simulated" && <p className="text-sm text-muted">Mode recette : paiement simulé, aucun débit.</p>}
        {b.tier === "free" && b.provider === "stripe-test" && (
          <p className="text-sm text-muted">Mode test Stripe : carte <span className="font-mono text-ink-2">4242 4242 4242 4242</span>, aucun débit.</p>
        )}
        {b.tier === "free" && b.provider !== "off" && (
          <Link href={retour ?? "/"} className="block text-sm text-muted underline-offset-2 hover:underline">Continuer gratuitement</Link>
        )}
      </section>

      <section className="card overflow-x-auto">
        <table className="w-full text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-border/70 text-left">
              <th className="py-3 pl-4 pr-2 font-medium text-muted sm:p-4">Ce que tu peux faire</th>
              <th className="w-[4.5rem] px-1 py-3 text-center sm:w-24 sm:p-4 font-medium">Gratuit</th>
              <th className="w-[4.5rem] px-1 py-3 text-center sm:w-24 sm:p-4 font-medium text-accent">Upclose+</th>
              <th className="w-[4.5rem] px-1 py-3 text-center sm:w-24 sm:p-4 font-medium">Black</th>
            </tr>
          </thead>
          <tbody>
            {planFeatures.map((f) => (
              <tr key={f.label} className="border-b border-border/40 last:border-0">
                <td className="py-3 pl-4 pr-2 text-ink-2 sm:p-4">{f.label}</td>
                <td className="px-1 py-3 text-center sm:p-4 text-muted"><Cell v={f.free} /></td>
                <td className="px-1 py-3 text-center sm:p-4"><Cell v={f.plus} /></td>
                <td className="px-1 py-3 text-center sm:p-4 font-medium"><Cell v={f.black} /></td>
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

import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { getBilling, safeReturn } from "@/server/billing";
import { plans } from "@/lib/premium";
import { blackThemeOn } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PremiumPlans } from "@/components/PremiumActions";
import { pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Offres");
export const dynamic = "force-dynamic";

export default async function PremiumPage({ searchParams }: { searchParams: Promise<{ retour?: string }> }) {
  const retour = safeReturn((await searchParams).retour);
  const viewer = await getViewerSafe();
  if (!viewer) redirect(`/connexion?suite=${encodeURIComponent(`/premium${retour ? `?retour=${retour}` : ""}`)}`);
  const b = await getBilling(viewer);
  const black = await blackThemeOn({ premiumUntil: b.until, premiumPlan: b.tier === "black" ? "black" : b.tier });
  const until = b.until ? new Date(b.until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card space-y-5 p-5 sm:p-7">
        <h1 className="font-display text-3xl">{b.tier === "free" ? "Choisis ton expérience Upclose" : `Tu es membre ${plans[b.tier].name}`}</h1>
        <p className="text-ink-2">
          {b.tier !== "free"
            ? `Actif jusqu'au ${until}${b.cancelAt ? "" : ", renouvelé automatiquement"}. Tu peux changer d'offre ou revenir au gratuit quand tu veux.`
            : "Touche une offre pour voir ce qu'elle t'apporte. Sans engagement : rejoindre des Moments, discuter et rester en sécurité reste gratuit pour tout le monde."}
        </p>
        {b.provider === "off" && b.tier === "free" && (
          <p className="rounded-2xl bg-surface-2/70 px-4 py-3 text-sm text-muted">Les abonnements ouvrent bientôt. Tout ce qui est gratuit reste ouvert.</p>
        )}
        <PremiumPlans tier={b.tier} cancelAt={b.cancelAt} source={b.source} returnTo={retour} canBuy={b.provider !== "off"} />
        {b.tier === "black" && <ThemeToggle black={black} />}
        {b.provider === "simulated" && <p className="text-sm text-muted">Mode recette : paiement simulé, aucun débit.</p>}
        {b.provider === "stripe-test" && (
          <p className="text-sm text-muted">Mode test Stripe : carte <span className="font-mono text-ink-2">4242 4242 4242 4242</span>, aucun débit.</p>
        )}
        {b.tier === "free" && b.provider !== "off" && (
          <Link href={retour ?? "/"} className="block text-sm text-muted underline-offset-2 hover:underline">Continuer gratuitement</Link>
        )}
      </section>

      <p className="text-center text-sm text-muted">
        <Link href="/moi" className="underline-offset-2 hover:underline">Retour à mon profil</Link>
      </p>
    </div>
  );
}

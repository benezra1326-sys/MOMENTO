import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { facebookEnabled } from "@/server/facebook";
import { googleEnabled } from "@/server/google";
import { listDemoAccounts } from "@/server/accounts";
import { DemoPicker, LoginForm, SocialButtons } from "@/components/AuthForms";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Connexion");
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  google_indisponible: "La connexion Google n'est pas encore activée sur ce serveur.",
  google_annule: "Connexion Google annulée.",
  google_etat: "La session de connexion a expiré. Réessaie.",
  google_echec: "La connexion Google a échoué. Réessaie.",
  facebook_indisponible: "La connexion Facebook n'est pas encore activée sur ce serveur.",
  facebook_annule: "Connexion Facebook annulée.",
  facebook_etat: "La session de connexion a expiré. Réessaie.",
  facebook_echec: "La connexion Facebook a échoué. Réessaie.",
  facebook_sans_email: "Ton compte Facebook ne partage pas d'adresse e-mail. Inscris-toi avec ton e-mail.",
  adresse_indisponible: "Cette adresse ne peut pas être reliée à ce compte. Connecte-toi avec ton e-mail.",
  suspendu: "Ce compte est suspendu.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; erreur?: string }> }) {
  const { suite, erreur } = await searchParams;
  if (await getViewerSafe()) redirect(suite && suite.startsWith("/") ? suite : "/");
  const demo = await listDemoAccounts().catch(() => []);
  const t = await getT();
  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2 lg:items-start">
      <section className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl">{t("Bon retour")}</h1>
        <p className="mt-1 text-muted">{t("Connecte-toi pour rejoindre ou créer des Moments.")}</p>
        {erreur && errors[erreur] && <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{t(errors[erreur])}</p>}
        <div className="mt-6">
          <SocialButtons next={suite} google={googleEnabled()} facebook={facebookEnabled()} />
          <LoginForm next={suite} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          {t("Pas encore de compte ?")} <Link href={`/inscription${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`} className="font-semibold text-ink underline-offset-2 hover:underline">{t("Inscris-toi")}</Link>
        </p>
        <p className="mt-3 text-center text-xs text-muted">
          <Link href="/confidentialite" className="underline-offset-2 hover:underline">{t("Confidentialité")}</Link>
        </p>
      </section>
      <DemoPicker accounts={demo} next={suite} />
    </div>
  );
}

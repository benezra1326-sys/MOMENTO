import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { googleEnabled } from "@/server/google";
import { listDemoAccounts } from "@/server/accounts";
import { DemoPicker, Divider, GoogleButton, LoginForm } from "@/components/AuthForms";

export const metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  google_indisponible: "La connexion Google n'est pas encore activée sur ce serveur.",
  google_annule: "Connexion Google annulée.",
  google_etat: "La session de connexion a expiré. Réessaie.",
  google_echec: "La connexion Google a échoué. Réessaie.",
  suspendu: "Ce compte est suspendu.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ suite?: string; erreur?: string }> }) {
  const { suite, erreur } = await searchParams;
  if (await getViewerSafe()) redirect(suite && suite.startsWith("/") ? suite : "/");
  const demo = await listDemoAccounts().catch(() => []);
  return (
    <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2 lg:items-start">
      <section className="card p-6 sm:p-8">
        <h1 className="font-display text-3xl">Bon retour</h1>
        <p className="mt-1 text-muted">Connecte-toi pour rejoindre ou créer des Moments.</p>
        {erreur && errors[erreur] && <p role="alert" className="mt-4 rounded-2xl bg-danger-soft px-4 py-2.5 text-sm text-danger">{errors[erreur]}</p>}
        <div className="mt-6">
          <GoogleButton next={suite} enabled={googleEnabled()} />
          {googleEnabled() && <Divider />}
          <LoginForm next={suite} />
        </div>
        <p className="mt-6 text-center text-sm text-muted">
          Pas encore de compte ? <Link href={`/inscription${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`} className="font-semibold text-ink underline-offset-2 hover:underline">Inscris-toi</Link>
        </p>
      </section>
      <DemoPicker accounts={demo} next={suite} />
    </div>
  );
}

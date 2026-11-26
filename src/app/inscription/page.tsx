import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { googleEnabled } from "@/server/google";
import { Divider, GoogleButton, SignupForm } from "@/components/AuthForms";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Créer un compte");
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  if (await getViewerSafe()) redirect("/");
  const t = await getT();
  return (
    <section className="card mx-auto max-w-xl p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t("Rejoins Momento")}</h1>
      <p className="mt-1 text-muted">{t("Une idée, des gens, un vrai moment.")}</p>
      <div className="mt-6">
        <GoogleButton next={suite} enabled={googleEnabled()} />
        {googleEnabled() && <Divider />}
        <SignupForm next={suite} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        {t("Déjà inscrit ?")} <Link href="/connexion" className="font-semibold text-ink underline-offset-2 hover:underline">{t("Connecte-toi")}</Link>
      </p>
    </section>
  );
}

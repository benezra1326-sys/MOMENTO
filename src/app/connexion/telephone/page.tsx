import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { PhoneLoginForm } from "@/components/AuthForms";
import { getT, pageTitle } from "@/lib/i18n/server";
import { phoneEnabled } from "@/server/phone";

export const generateMetadata = pageTitle("Connexion par téléphone");
export const dynamic = "force-dynamic";

export default async function PhoneLoginPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  if (await getViewerSafe()) redirect(suite && suite.startsWith("/") && !suite.startsWith("//") ? suite : "/");
  if (!phoneEnabled()) redirect("/connexion");
  const t = await getT();
  return (
    <section className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t("Avec ton numéro")}</h1>
      <p className="mt-1 text-muted">{t("Pas de mot de passe : un code par SMS suffit. Nouveau numéro ? Ton compte est créé tout de suite.")}</p>
      <div className="mt-6">
        <PhoneLoginForm next={suite} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href={`/connexion${suite ? `?suite=${encodeURIComponent(suite)}` : ""}`} className="font-semibold text-ink underline-offset-2 hover:underline">
          {t("Autres façons de se connecter")}
        </Link>
      </p>
    </section>
  );
}

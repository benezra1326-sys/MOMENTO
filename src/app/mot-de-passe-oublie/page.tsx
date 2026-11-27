import Link from "next/link";
import { ForgotPasswordForm } from "@/components/AccountEmail";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Mot de passe oublié");

export default async function ForgotPasswordPage() {
  const t = await getT();
  return (
    <section className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t("Mot de passe oublié")}</h1>
      <p className="mt-1 text-muted">{t("Indique ton adresse : tu recevras un lien valable une heure pour en choisir un nouveau.")}</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/connexion" className="font-semibold text-accent underline-offset-2 hover:underline">{t("Retour à la connexion")}</Link>
      </p>
    </section>
  );
}

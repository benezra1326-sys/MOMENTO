import Link from "next/link";
import { ForgotPasswordForm } from "@/components/AccountEmail";

export const metadata = { title: "Mot de passe oublié" };

export default function ForgotPasswordPage() {
  return (
    <section className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="font-display text-3xl">Mot de passe oublié</h1>
      <p className="mt-1 text-muted">Indique ton adresse : tu recevras un lien valable une heure pour en choisir un nouveau.</p>
      <div className="mt-6">
        <ForgotPasswordForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        <Link href="/connexion" className="font-semibold text-ink underline-offset-2 hover:underline">Retour à la connexion</Link>
      </p>
    </section>
  );
}

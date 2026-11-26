import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { googleEnabled } from "@/server/google";
import { Divider, GoogleButton, SignupForm } from "@/components/AuthForms";

export const metadata = { title: "Créer un compte" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const { suite } = await searchParams;
  if (await getViewerSafe()) redirect("/");
  return (
    <section className="card mx-auto max-w-xl p-6 sm:p-8">
      <h1 className="font-display text-3xl">Rejoins Momento</h1>
      <p className="mt-1 text-muted">Une idée, des gens, un vrai moment.</p>
      <div className="mt-6">
        <GoogleButton next={suite} enabled={googleEnabled()} />
        {googleEnabled() && <Divider />}
        <SignupForm next={suite} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Déjà inscrit ? <Link href="/connexion" className="font-semibold text-ink underline-offset-2 hover:underline">Connecte-toi</Link>
      </p>
    </section>
  );
}

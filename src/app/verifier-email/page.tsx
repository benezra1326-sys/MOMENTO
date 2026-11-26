import { ConfirmEmail } from "@/components/AccountEmail";

export const metadata = { title: "Confirmer mon adresse", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  return (
    <section className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="font-display text-3xl">Confirme ton adresse</h1>
      <p className="mt-1 text-muted">Un clic et c&apos;est bon : tu pourras créer et rejoindre des Moments.</p>
      <div className="mt-6">
        <ConfirmEmail token={jeton ?? ""} />
      </div>
    </section>
  );
}

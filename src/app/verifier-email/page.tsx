import { ConfirmEmail } from "@/components/AccountEmail";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Confirmer mon adresse", { referrer: "no-referrer" });

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  const t = await getT();
  return (
    <section className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t("Confirme ton adresse")}</h1>
      <p className="mt-1 text-muted">{t("Un clic et c'est bon : tu pourras créer et rejoindre des Moments.")}</p>
      <div className="mt-6">
        <ConfirmEmail token={jeton ?? ""} />
      </div>
    </section>
  );
}

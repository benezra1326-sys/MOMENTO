import { ResetPasswordForm } from "@/components/AccountEmail";
import { getT, pageTitle } from "@/lib/i18n/server";

export const generateMetadata = pageTitle("Nouveau mot de passe", { referrer: "no-referrer" });

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ jeton?: string }> }) {
  const { jeton } = await searchParams;
  const t = await getT();
  return (
    <section className="card mx-auto max-w-md p-6 sm:p-8">
      <h1 className="font-display text-3xl">{t("Nouveau mot de passe")}</h1>
      <p className="mt-1 text-muted">{t("Tes autres connexions seront fermées par sécurité.")}</p>
      <div className="mt-6">
        <ResetPasswordForm token={jeton ?? ""} />
      </div>
    </section>
  );
}

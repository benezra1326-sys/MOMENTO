import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewerSafe } from "@/lib/auth";
import { getMyProfile, getPublicProfile } from "@/server/accounts";
import { listMyBlocks } from "@/server/safety";
import { ProfileHeader, ProfileMoments } from "@/components/ProfileHeader";
import { ProfileSettings } from "@/components/ProfileSettings";
import { getT, pageTitle } from "@/lib/i18n/server";
import { Crown, Sparkles } from "lucide-react";
import { tierOf } from "@/lib/premium";
import { blackThemeOn } from "@/lib/theme";
import { ThemeToggle } from "@/components/ThemeToggle";

export const generateMetadata = pageTitle("Mon profil");
export const dynamic = "force-dynamic";

export default async function MePage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const viewer = await getViewerSafe();
  if (!viewer) redirect("/connexion?suite=/moi");
  const { bienvenue } = await searchParams;
  const t = await getT();
  // Requêtes séquentielles : une seule connexion à la base en production.
  const me = await getMyProfile(viewer);
  const profile = await getPublicProfile(viewer, viewer.username);
  const blocks = await listMyBlocks(viewer);
  const tier = tierOf(viewer);
  const black = await blackThemeOn(viewer);
  return (
    <div className="space-y-8">
      <ProfileHeader p={profile}>
        <a href="#modifier" className="btn-primary">{t("Modifier")}</a>
        <Link href={`/u/${viewer.username}`} className="btn-secondary">{t("Aperçu public")}</Link>
        <Link href="/premium" className="btn-secondary">{profile.tier !== "free" ? t("Mon abonnement") : t("Offres")}</Link>
      </ProfileHeader>
      <section className={`flex flex-wrap items-center gap-4 rounded-3xl border p-5 ${tier === "black" ? "border-[#d4af6a]/50 bg-black" : "border-[#d4af6a]/30 bg-[radial-gradient(120%_100%_at_100%_0%,#3a2f17_0%,transparent_60%)]"}`}>
        <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-black text-[#e2c486] ring-1 ring-[#d4af6a]/50">
          {tier === "free" ? <Sparkles size={22} aria-hidden /> : <Crown size={22} aria-hidden />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{tier === "black" ? t("Tu es membre Upclose Black") : tier === "plus" ? t("Tu es membre Upclose+") : t("Offre gratuite")}</p>
          <p className="text-sm text-muted">
            {tier === "black" ? t("Qui t'a vu, personnes pour toi, Moments réservés, 4 boosts par mois.") : tier === "plus" ? t("Passe à Black pour voir qui t'a vu, recevoir des suggestions et le thème noir et or.") : t("Compare Upclose+ et Black : Moments illimités, boosts, qui t'a vu…")}
          </p>
        </div>
        <Link href="/premium" className="btn-secondary w-full sm:w-auto">{tier === "free" ? t("Voir les offres") : t("Gérer mon offre")}</Link>
        {tier === "black" && (
          <div className="flex w-full flex-wrap gap-2">
            <Link href="/vues" className="btn-secondary flex-1">{t("Qui m'a vu")}</Link>
            <Link href="/personnes" className="btn-secondary flex-1">{t("Personnes pour toi")}</Link>
          </div>
        )}
        {tier === "black" && <div className="w-full"><ThemeToggle black={black} /></div>}
      </section>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="order-2 lg:order-1"><ProfileMoments p={profile} narrow /></div>
        <div id="modifier" className="order-1 scroll-mt-20 lg:order-2"><ProfileSettings me={me} blocks={blocks} welcome={bienvenue === "1"} /></div>
      </div>
    </div>
  );
}

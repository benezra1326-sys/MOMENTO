import Link from "next/link";
import { Bell, Shield } from "lucide-react";
import { emailVerificationRequired, type Viewer } from "@/lib/auth";
import { isDemoMode } from "@/lib/env";
import { Avatar } from "./Avatar";
import { VerifyEmailBanner } from "./AccountEmail";
import { Logo } from "./Logo";
import { BottomNav, SideNav } from "./Nav";
import { getT } from "@/lib/i18n/server";

export async function AppShell({ viewer, unread, children }: { viewer: Viewer | null; unread: number; children: React.ReactNode }) {
  const demo = isDemoMode();
  const t = await getT();
  if (!viewer) {
    // Non connecté : seulement les pages de connexion et d'inscription, sans navigation dans l'app.
    return (
      <div className="min-h-dvh">
        <header className="flex h-16 items-center justify-center border-b border-line/70 bg-cream/85 px-4">
          <Link href="/connexion" aria-label={t("Momento, accueil")}><Logo id="mlogo-top" /></Link>
        </header>
        {demo && (
          <div className="border-b border-warn/15 bg-warn-soft px-4 py-2 text-center text-[13px] text-warn">
            {t("Version de démonstration : les profils et Moments marqués « Démo » sont fictifs.")}
          </div>
        )}
        <main id="contenu" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          {children}
        </main>
      </div>
    );
  }
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        {t("Aller au contenu")}
      </a>

      {/* Barre latérale (ordinateur) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-paper/70 px-5 py-6 backdrop-blur lg:flex">
        <Link href="/" className="mb-8 px-2"><Logo id="mlogo-side" /></Link>
        <SideNav signedIn={!!viewer} unread={unread} />
        <div className="mt-auto space-y-3">
          {viewer?.role === "ADMIN" && (
            <Link href="/admin" className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium text-muted hover:bg-sand">
              <Shield size={16} /> {t("Modération")}
            </Link>
          )}
          {viewer ? (
            <Link href="/moi" className="flex items-center gap-3 rounded-2xl p-2 hover:bg-sand">
              <Avatar person={viewer} size="md" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{viewer.name}</span>
                <span className="block truncate text-xs text-muted">@{viewer.username}</span>
              </span>
            </Link>
          ) : (
            <div className="space-y-2">
              <Link href="/connexion" className="btn-primary w-full">{t("Se connecter")}</Link>
              <Link href="/inscription" className="btn-secondary w-full">{t("Créer un compte")}</Link>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* En-tête (mobile et tablette) */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-cream/85 px-4 backdrop-blur-md lg:hidden">
          <Link href="/" aria-label={t("Momento, accueil")}><Logo id="mlogo-top" /></Link>
          <div className="flex items-center gap-1">
            {viewer ? (
              <Link href="/notifications" className="relative inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-sand" aria-label={unread ? t("Notifications, {n} non lues", { n: unread }) : t("Notifications")}>
                <Bell size={21} />
                {unread > 0 && <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-rose ring-2 ring-cream" />}
              </Link>
            ) : (
              <Link href="/connexion" className="btn-primary !min-h-9 !px-4 text-sm">{t("Se connecter")}</Link>
            )}
          </div>
        </header>

        {demo && (
          <div className="border-b border-warn/15 bg-warn-soft px-4 py-2 text-center text-[13px] text-warn">
            {t("Version de démonstration : les profils et Moments marqués « Démo » sont fictifs.")}
          </div>
        )}

        {viewer && !viewer.isDemo && !viewer.emailVerifiedAt && emailVerificationRequired() && <VerifyEmailBanner required />}

        <main id="contenu" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-8">
          {children}
        </main>
      </div>

      <BottomNav signedIn={!!viewer} unread={unread} />
    </div>
  );
}

import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPublicPath } from "@/lib/public-paths";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { getViewerSafe } from "@/lib/auth";
import { unreadCount } from "@/server/notifications";
import { AppShell } from "@/components/AppShell";
import { productConfig } from "@/config/product";
import { I18nProvider } from "@/components/I18nProvider";
import { getLocale, getT } from "@/lib/i18n/server";
import { blackThemeOn } from "@/lib/theme";

/** Adresse publique canonique (liens de partage, image de partage). */
const SITE_URL = (process.env.APP_URL || "https://upclose.world").replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  const black = await blackThemeOn(await getViewerSafe()).catch(() => false);
  const title = t("Upclose — La vie est plus belle de près.");
  const description = t("Découvre un Moment près de toi, demande à le rejoindre ou crée le tien, puis rencontre les participants en vrai.");
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: "%s · Upclose" },
    description,
    applicationName: productConfig.appName,
    appleWebApp: { title: productConfig.appName },
    openGraph: { type: "website", siteName: productConfig.appName, title, description, url: SITE_URL },
    twitter: { card: "summary_large_image", title, description },
    // Membre Black avec le thème noir : icône noir et or.
    ...(black ? { icons: { icon: "/brand/favicon-black-32.png", apple: "/brand/apple-icon-black.png" } } : {}),
  };
}

export async function generateViewport(): Promise<Viewport> {
  const black = await blackThemeOn(await getViewerSafe()).catch(() => false);
  return { width: "device-width", initialScale: 1, themeColor: black ? "#000000" : "#1D1626", viewportFit: "cover" };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewerSafe();
  const path = (await headers()).get("x-pathname") ?? "/";
  // Session absente ou expirée : seules les pages de connexion et d'inscription sont visibles.
  if (!viewer && !isPublicPath(path)) redirect(path === "/" ? "/connexion" : `/connexion?suite=${encodeURIComponent(path)}`);
  const unread = viewer ? await unreadCount(viewer.id).catch(() => 0) : 0;
  const locale = await getLocale();
  const black = await blackThemeOn(viewer);
  return (
    <html lang={locale} data-theme={black ? "black" : undefined}>
      <body className="antialiased">
        <I18nProvider locale={locale}>
          <AppShell viewer={viewer} unread={unread}>
            {children}
          </AppShell>
        </I18nProvider>
      </body>
    </html>
  );
}

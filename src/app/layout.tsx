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

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: { default: t("Momento — Moins de scroll. Plus de moments vécus."), template: "%s · Momento" },
    description: t("Découvre un Moment près de toi, demande à le rejoindre ou crée le tien, puis rencontre les participants en vrai."),
    applicationName: productConfig.appName,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf6f0",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewerSafe();
  const path = (await headers()).get("x-pathname") ?? "/";
  // Session absente ou expirée : seules les pages de connexion et d'inscription sont visibles.
  if (!viewer && !isPublicPath(path)) redirect(path === "/" ? "/connexion" : `/connexion?suite=${encodeURIComponent(path)}`);
  const unread = viewer ? await unreadCount(viewer.id).catch(() => 0) : 0;
  const locale = await getLocale();
  return (
    <html lang={locale}>
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

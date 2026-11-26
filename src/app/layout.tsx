import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { getViewerSafe } from "@/lib/auth";
import { unreadCount } from "@/server/notifications";
import { AppShell } from "@/components/AppShell";
import { productConfig } from "@/config/product";

export const metadata: Metadata = {
  title: { default: "Momento — Moins de scroll. Plus de moments vécus.", template: "%s · Momento" },
  description: "Découvre un Moment près de toi, demande à le rejoindre ou crée le tien, puis rencontre les participants en vrai.",
  applicationName: productConfig.appName,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf6f0",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewerSafe();
  const unread = viewer ? await unreadCount(viewer.id).catch(() => 0) : 0;
  return (
    <html lang="fr">
      <body className="antialiased">
        <AppShell viewer={viewer} unread={unread}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}

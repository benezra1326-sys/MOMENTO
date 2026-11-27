"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Compass, Home, Mail, Plus, User } from "lucide-react";
import { useT } from "./I18nProvider";

const items = [
  { href: "/", label: "Feed", icon: Home, match: (p: string) => p === "/" },
  { href: "/explorer", label: "Explorer", icon: Compass, match: (p: string) => p.startsWith("/explorer") },
  { href: "/moments/nouveau", label: "Créer", icon: Plus, match: (p: string) => p === "/moments/nouveau", primary: true },
  { href: "/invitations", label: "Invitations", icon: Mail, match: (p: string) => p.startsWith("/invitations") },
  { href: "/moi", label: "Profil", icon: User, match: (p: string) => p.startsWith("/moi") || p.startsWith("/u/") },
];

export function BottomNav({ signedIn, unread }: { signedIn: boolean; unread: number }) {
  const path = usePathname();
  const t = useT();
  return (
    <nav
      aria-label={t("Navigation principale")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {items.map(({ href, label, icon: Icon, match, primary }) => {
          const active = match(path);
          const target = !signedIn && (href === "/moments/nouveau" || href === "/invitations" || href === "/moi") ? `/connexion?suite=${encodeURIComponent(href)}` : href;
          return (
            <li key={href}>
              <Link
                href={target}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active ? "text-accent" : "text-muted"}`}
              >
                {primary ? (
                  <span className="-mt-1 inline-flex h-11 w-11 items-center justify-center rounded-full bg-signature text-white shadow-lg shadow-primary/25">
                    <Icon size={22} strokeWidth={2.4} />
                  </span>
                ) : (
                  <Icon size={22} strokeWidth={active ? 2.4 : 1.9} />
                )}
                <span className={primary ? "sr-only" : ""}>{t(label)}</span>
                {href === "/invitations" && unread > 0 && <span className="absolute right-[30%] top-3 h-2 w-2 rounded-full bg-coral" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function SideNav({ signedIn, unread }: { signedIn: boolean; unread: number }) {
  const path = usePathname();
  const t = useT();
  const list = [...items.filter((i) => !i.primary), { href: "/notifications", label: "Notifications", icon: Bell, match: (p: string) => p.startsWith("/notifications") }];
  return (
    <nav aria-label={t("Navigation principale")} className="space-y-1">
      <Link href={signedIn ? "/moments/nouveau" : "/connexion?suite=/moments/nouveau"} className="btn-primary mb-5 w-full">
        <Plus size={18} strokeWidth={2.4} /> {t("Créer un Moment")}
      </Link>
      {list.map(({ href, label, icon: Icon, match }) => {
        const active = match(path);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px] font-medium transition-colors ${active ? "bg-ink text-night" : "text-ink-2 hover:bg-surface-2"}`}
          >
            <Icon size={20} strokeWidth={active ? 2.3 : 1.9} />
            {t(label)}
            {href === "/notifications" && unread > 0 && (
              <span className={`ml-auto rounded-full px-2 text-xs font-semibold ${active ? "bg-night text-cream" : "bg-coral text-night"}`}>{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

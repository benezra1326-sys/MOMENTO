import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/core";

import { isPublicPath } from "@/lib/public-paths";

const SESSION_COOKIE = "momento_session";

/**
 * 1. Lien de partage dans une langue : …?lang=en (ou fr). La langue est mémorisée en cookie, puis le
 *    paramètre est retiré de l'URL. Sans ce lien, la langue suit celle du navigateur.
 * 2. Sans session, toute page hors connexion/inscription renvoie vers la connexion.
 *    (Contrôle rapide sur la présence du cookie ; la session est vérifiée côté serveur dans le layout et les routes API.)
 */
export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const lang = url.searchParams.get("lang");
  if (lang) {
    const clean = url.clone();
    clean.searchParams.delete("lang");
    const res = NextResponse.redirect(clean);
    if (isLocale(lang)) res.cookies.set(LOCALE_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    else if (lang === "auto") res.cookies.delete(LOCALE_COOKIE);
    return res;
  }

  if (!isPublicPath(url.pathname) && !req.cookies.get(SESSION_COOKIE)) {
    const login = url.clone();
    login.pathname = "/connexion";
    login.search = url.pathname === "/" ? "" : `?suite=${encodeURIComponent(url.pathname + url.search)}`;
    return NextResponse.redirect(login);
  }

  const headers = new Headers(req.headers);
  headers.set("x-pathname", url.pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!api|_next|demo|uploads|favicon.ico|.*\\.(?:png|jpg|webp|svg|mp4|ico)$).*)"] };

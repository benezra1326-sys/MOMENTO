import { NextResponse, type NextRequest } from "next/server";
import { isLocale, LOCALE_COOKIE, LOCALE_HEADER, localeFromHost } from "@/lib/i18n/core";

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
  // Adresse de démo dédiée (ex. upclose-en.vercel.app) : toujours dans cette langue, sans cookie.
  const hostLocale = localeFromHost(req.headers.get("host"));
  const linkLocale = isLocale(lang) ? lang : null;
  const remember = (res: NextResponse) => {
    if (linkLocale) res.cookies.set(LOCALE_COOKIE, linkLocale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    else if (lang === "auto") res.cookies.delete(LOCALE_COOKIE);
    return res;
  };

  if (!isPublicPath(url.pathname) && !req.cookies.get(SESSION_COOKIE)) {
    const login = url.clone();
    login.pathname = "/connexion";
    const rest = new URLSearchParams(url.search);
    rest.delete("lang");
    const back = url.pathname + (rest.size ? `?${rest}` : "");
    login.search = url.pathname === "/" ? "" : `?suite=${encodeURIComponent(back)}`;
    return remember(NextResponse.redirect(login));
  }

  // La langue choisie s'applique dès cette page (en-tête) et aux suivantes (cookie).
  const headers = new Headers(req.headers);
  headers.set("x-pathname", url.pathname);
  const forced = hostLocale ?? linkLocale;
  if (forced) headers.set(LOCALE_HEADER, forced);
  else headers.delete(LOCALE_HEADER);
  return remember(NextResponse.next({ request: { headers } }));
}

export const config = { matcher: ["/((?!api|_next|demo|uploads|favicon.ico|.*\\.(?:png|jpg|webp|svg|mp4|ico|webmanifest)$).*)"] };

import { cookies, headers } from "next/headers";
import { isLocale, localeFromAcceptLanguage, makeT, type Locale } from "./core";
import { LOCALE_COOKIE, LOCALE_HEADER, localeFromHost } from "./core";

/** Langue de la requête : lien partagé (?lang=…, mémorisé en cookie), sinon langue du navigateur. */
export async function getLocale(): Promise<Locale> {
  try {
    const h = await headers();
    const fromHost = localeFromHost(h.get("host"));
    if (fromHost) return fromHost;
    const fromLink = h.get(LOCALE_HEADER);
    if (isLocale(fromLink)) return fromLink;
    const forced = (await cookies()).get(LOCALE_COOKIE)?.value;
    if (isLocale(forced)) return forced;
    return localeFromAcceptLanguage(h.get("accept-language"));
  } catch {
    return "fr";
  }
}

export async function getT() {
  return makeT(await getLocale());
}

/** Titre de page traduit : `export const generateMetadata = pageTitle("Explorer");` */
export function pageTitle(title: string, extra: Record<string, unknown> = {}) {
  return async () => ({ title: (await getT())(title), ...extra });
}

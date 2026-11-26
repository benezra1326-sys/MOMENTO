import { cookies, headers } from "next/headers";
import { isLocale, localeFromAcceptLanguage, makeT, type Locale } from "./core";
import { LOCALE_COOKIE } from "./core";

/** Langue de la requête : lien partagé (?lang=…, mémorisé en cookie), sinon langue du navigateur. */
export async function getLocale(): Promise<Locale> {
  try {
    const jar = await cookies();
    const forced = jar.get(LOCALE_COOKIE)?.value;
    if (isLocale(forced)) return forced;
    const h = await headers();
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

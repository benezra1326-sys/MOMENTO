import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { exchangeFacebookCode, facebookEnabled, upsertFacebookUser } from "@/server/facebook";
import { safeNext } from "@/server/oauth";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const state = jar.get("fb_state")?.value;
  const next = safeNext(jar.get("fb_next")?.value);
  const fail = (code: string) => NextResponse.redirect(new URL(`/connexion?erreur=${code}`, url));

  if (!facebookEnabled()) return fail("facebook_indisponible");
  if (url.searchParams.get("error")) return fail("facebook_annule");
  const code = url.searchParams.get("code");
  if (!code || !state || url.searchParams.get("state") !== state) return fail("facebook_etat");

  try {
    const profile = await exchangeFacebookCode(req, code);
    if (!profile.email) return fail("facebook_sans_email");
    const user = await upsertFacebookUser(profile);
    await createSession(user.id);
    const dest = user.isNew ? "/moi?bienvenue=1" : (next ?? "/");
    const res = NextResponse.redirect(new URL(dest, url));
    for (const c of ["fb_state", "fb_next"]) res.cookies.set(c, "", { path: "/api/auth/facebook", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("[facebook] échec de connexion", e instanceof AppError ? e.message : e);
    return fail(e instanceof AppError && e.code === "ACCOUNT_SUSPENDED" ? "suspendu" : e instanceof AppError && e.code === "CONFLICT" ? "adresse_indisponible" : "facebook_echec");
  }
}

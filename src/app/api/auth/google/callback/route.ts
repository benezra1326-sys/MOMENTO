import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { exchangeCode, googleEnabled, upsertGoogleUser } from "@/server/google";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const jar = await cookies();
  const state = jar.get("g_state")?.value;
  const verifier = jar.get("g_verifier")?.value;
  const next = jar.get("g_next")?.value;
  const fail = (code: string) => NextResponse.redirect(new URL(`/connexion?erreur=${code}`, url));

  if (!googleEnabled()) return fail("google_indisponible");
  if (url.searchParams.get("error")) return fail("google_annule");
  const code = url.searchParams.get("code");
  if (!code || !state || !verifier || url.searchParams.get("state") !== state) return fail("google_etat");

  try {
    const profile = await exchangeCode(req, code, verifier);
    const user = await upsertGoogleUser(profile);
    await createSession(user.id);
    const dest = user.isNew ? "/moi?bienvenue=1" : next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
    const res = NextResponse.redirect(new URL(dest, url));
    for (const c of ["g_state", "g_verifier", "g_next"]) res.cookies.set(c, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  } catch (e) {
    console.error("[google] échec de connexion", e instanceof AppError ? e.message : e);
    return fail(e instanceof AppError && e.code === "ACCOUNT_SUSPENDED" ? "suspendu" : "google_echec");
  }
}

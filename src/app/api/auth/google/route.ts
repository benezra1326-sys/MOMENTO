import { NextResponse } from "next/server";
import { authorizeUrl, googleEnabled } from "@/server/google";
import { newPkce, safeNext } from "@/server/oauth";

/** GET /api/auth/google?suite=/chemin — démarre la connexion Google. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!googleEnabled()) {
    return NextResponse.redirect(new URL("/connexion?erreur=google_indisponible", url));
  }
  const { verifier, challenge, state } = newPkce();
  const suite = safeNext(url.searchParams.get("suite"));
  const res = NextResponse.redirect(authorizeUrl(req, state, challenge));
  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, sameSite: "lax" as const, secure, path: "/api/auth/google", maxAge: 600 };
  res.cookies.set("g_state", state, opts);
  res.cookies.set("g_verifier", verifier, opts);
  if (suite) res.cookies.set("g_next", suite, opts);
  return res;
}

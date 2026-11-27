import { NextResponse } from "next/server";
import { facebookAuthorizeUrl, facebookEnabled } from "@/server/facebook";
import { newPkce, safeNext } from "@/server/oauth";

/** GET /api/auth/facebook?suite=/chemin — démarre la connexion Facebook. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!facebookEnabled()) {
    return NextResponse.redirect(new URL("/connexion?erreur=facebook_indisponible", url));
  }
  const { state } = newPkce();
  const suite = safeNext(url.searchParams.get("suite"));
  const res = NextResponse.redirect(facebookAuthorizeUrl(req, state));
  const secure = process.env.NODE_ENV === "production";
  const opts = { httpOnly: true, sameSite: "lax" as const, secure, path: "/api/auth/facebook", maxAge: 600 };
  res.cookies.set("fb_state", state, opts);
  if (suite) res.cookies.set("fb_next", suite, opts);
  return res;
}

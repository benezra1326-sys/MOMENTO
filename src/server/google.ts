/**
 * Connexion Google (OAuth 2.0 / OpenID Connect, flux « authorization code » + PKCE).
 * S'active automatiquement quand GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont définis.
 * Voir docs/GOOGLE_SIGN_IN.md pour créer les identifiants.
 */
import { AppError } from "@/lib/errors";
import { callbackUrl, upsertOAuthUser } from "./oauth";

export function googleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function authorizeUrl(req: Request, state: string, challenge: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(req, "google"),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type GoogleProfile = { sub: string; email: string; email_verified: boolean; name?: string; picture?: string };

/** Échange le code contre un id_token, puis le fait vérifier par Google (signature, audience, expiration). */
export async function exchangeCode(req: Request, code: string, verifier: string): Promise<GoogleProfile> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: callbackUrl(req, "google"),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  const tokens = (await tokenRes.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!tokenRes.ok || !tokens.id_token) {
    throw new AppError("UNAUTHENTICATED", "Google a refusé la connexion. Réessaie.");
  }
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokens.id_token)}`);
  const info = (await infoRes.json().catch(() => ({}))) as Record<string, string>;
  if (!infoRes.ok || info.aud !== process.env.GOOGLE_CLIENT_ID || !["accounts.google.com", "https://accounts.google.com"].includes(info.iss)) {
    throw new AppError("UNAUTHENTICATED", "Jeton Google invalide.");
  }
  return {
    sub: info.sub,
    email: (info.email ?? "").toLowerCase(),
    email_verified: info.email_verified === "true",
    name: info.name,
    picture: info.picture,
  };
}

/** Trouve ou crée le compte lié à ce profil Google. */
export function upsertGoogleUser(profile: GoogleProfile) {
  return upsertOAuthUser("google", { id: profile.sub, email: profile.email, emailVerified: profile.email_verified, name: profile.name });
}

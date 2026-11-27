/**
 * Connexion Facebook (Facebook Login, flux « authorization code » côté serveur).
 * S'active automatiquement quand FACEBOOK_APP_ID et FACEBOOK_APP_SECRET sont définis.
 * Voir docs/FACEBOOK_SIGN_IN.md pour créer l'app chez Meta.
 */
import { createHmac } from "node:crypto";
import { AppError } from "@/lib/errors";
import { callbackUrl, upsertOAuthUser } from "./oauth";

const GRAPH = `https://graph.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0"}`;
const DIALOG = `https://www.facebook.com/${process.env.FACEBOOK_GRAPH_VERSION ?? "v25.0"}/dialog/oauth`;

export function facebookEnabled(): boolean {
  return !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);
}

export function facebookAuthorizeUrl(req: Request, state: string) {
  const p = new URLSearchParams({
    client_id: process.env.FACEBOOK_APP_ID!,
    redirect_uri: callbackUrl(req, "facebook"),
    response_type: "code",
    scope: "public_profile,email",
    state,
  });
  return `${DIALOG}?${p}`;
}

export type FacebookProfile = { id: string; email?: string; name?: string };

async function getJson(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, body };
}

/** Échange le code contre un jeton, vérifie qu'il a été émis pour l'app Momento, puis lit le profil. */
export async function exchangeFacebookCode(req: Request, code: string): Promise<FacebookProfile> {
  const appId = process.env.FACEBOOK_APP_ID!;
  const secret = process.env.FACEBOOK_APP_SECRET!;
  const token = await getJson(
    `${GRAPH}/oauth/access_token?${new URLSearchParams({ client_id: appId, client_secret: secret, redirect_uri: callbackUrl(req, "facebook"), code })}`,
  );
  const accessToken = token.body.access_token;
  if (!token.ok || typeof accessToken !== "string") {
    throw new AppError("UNAUTHENTICATED", "Facebook a refusé la connexion. Réessaie.");
  }
  const debug = await getJson(`${GRAPH}/debug_token?${new URLSearchParams({ input_token: accessToken, access_token: `${appId}|${secret}` })}`);
  const data = (debug.body.data ?? {}) as { app_id?: string; is_valid?: boolean; user_id?: string };
  if (!debug.ok || !data.is_valid || data.app_id !== appId || !data.user_id) {
    throw new AppError("UNAUTHENTICATED", "Jeton Facebook invalide.");
  }
  const proof = createHmac("sha256", secret).update(accessToken).digest("hex");
  const me = await getJson(`${GRAPH}/me?${new URLSearchParams({ fields: "id,name,email", access_token: accessToken, appsecret_proof: proof })}`);
  if (!me.ok || me.body.id !== data.user_id) {
    throw new AppError("UNAUTHENTICATED", "Facebook a refusé la connexion. Réessaie.");
  }
  return {
    id: String(me.body.id),
    email: typeof me.body.email === "string" ? me.body.email.toLowerCase() : undefined,
    name: typeof me.body.name === "string" ? me.body.name : undefined,
  };
}

/**
 * Trouve ou crée le compte lié à ce profil Facebook.
 * Facebook ne transmet que l'adresse principale confirmée du compte : elle est donc considérée comme vérifiée.
 */
export function upsertFacebookUser(profile: FacebookProfile) {
  return upsertOAuthUser("facebook", { id: profile.id, email: profile.email ?? "", emailVerified: !!profile.email, name: profile.name });
}

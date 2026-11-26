/**
 * Connexion Google (OAuth 2.0 / OpenID Connect, flux « authorization code » + PKCE).
 * S'active automatiquement quand GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET sont définis.
 * Voir docs/GOOGLE_SIGN_IN.md pour créer les identifiants.
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { AppError, isUniqueViolation } from "@/lib/errors";

export function googleEnabled(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function appBaseUrl(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function redirectUri(req: Request) {
  return `${appBaseUrl(req)}/api/auth/google/callback`;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function authorizeUrl(req: Request, state: string, challenge: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(req),
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
      redirect_uri: redirectUri(req),
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

async function uniqueUsername(base: string) {
  const clean =
    base
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9_.]/g, "")
      .slice(0, 18) || "membre";
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? clean : `${clean}${Math.floor(Math.random() * 9000 + 1000)}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken && candidate.length >= 3) return candidate;
  }
  return `membre${Date.now().toString(36)}`;
}

/**
 * Trouve ou crée le compte lié à ce profil Google.
 * Un compte e-mail existant est relié seulement si Google confirme l'adresse.
 */
export async function upsertGoogleUser(profile: GoogleProfile): Promise<{ id: string; isNew: boolean }> {
  if (!profile.email || !profile.email_verified) {
    throw new AppError("UNAUTHENTICATED", "Ton adresse Google n'est pas vérifiée.");
  }
  const byGoogle = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (byGoogle) {
    if (byGoogle.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
    if (byGoogle.status === "DELETED") throw new AppError("UNAUTHENTICATED", "Ce compte a été supprimé.");
    return { id: byGoogle.id, isNew: false };
  }
  const byEmail = await prisma.user.findUnique({ where: { email: profile.email } });
  if (byEmail) {
    if (byEmail.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
    if (byEmail.isDemo || byEmail.status === "DELETED") throw new AppError("CONFLICT", "Cette adresse ne peut pas être utilisée.");
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { googleId: profile.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() },
    });
    return { id: byEmail.id, isNew: false };
  }
  const name = (profile.name ?? profile.email.split("@")[0]).slice(0, 50);
  const create = async (username: string) =>
    prisma.user.create({
      data: {
        email: profile.email,
        googleId: profile.sub,
        emailVerifiedAt: new Date(),
        name: name.length >= 2 ? name : "Membre",
        username,
        // Photo Google non importée automatiquement : la personne choisit sa photo dans son profil.
      },
    });
  let user;
  try {
    user = await create(await uniqueUsername(profile.email.split("@")[0]));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Course entre deux connexions simultanées : soit le compte vient d'être créé, soit le pseudo a été pris.
    const again = await prisma.user.findUnique({ where: { googleId: profile.sub } });
    if (again) return { id: again.id, isNew: false };
    user = await create(`membre${Date.now().toString(36)}`);
  }
  return { id: user.id, isNew: true };
}

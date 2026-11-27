/**
 * Briques communes aux connexions « Continuer avec Google / Facebook ».
 */
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { AppError, isUniqueViolation } from "@/lib/errors";

export type OAuthProvider = "google" | "facebook";

/**
 * Adresse publique utilisée pour l'adresse de retour OAuth : celle où la personne a cliqué.
 * Ainsi la connexion marche aussi bien sur momento-jade-nu.vercel.app que sur momento-en.vercel.app
 * (les cookies de « state » sont posés sur l'adresse de départ). Une adresse non déclarée chez
 * Google ou Facebook est simplement refusée par eux.
 */
export function oauthBaseUrl(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export function callbackUrl(req: Request, provider: OAuthProvider) {
  return `${oauthBaseUrl(req)}/api/auth/${provider}/callback`;
}

export function newPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const state = randomBytes(16).toString("base64url");
  return { verifier, challenge, state };
}

export function safeNext(next?: string | null) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
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

export type OAuthProfile = { id: string; email: string; emailVerified: boolean; name?: string };

const LABEL: Record<OAuthProvider, string> = { google: "Google", facebook: "Facebook" };

/**
 * Trouve ou crée le compte lié à ce profil Google ou Facebook.
 * Un compte e-mail existant est relié seulement si le fournisseur confirme l'adresse. Jamais un compte démo.
 */
export async function upsertOAuthUser(provider: OAuthProvider, profile: OAuthProfile): Promise<{ id: string; isNew: boolean }> {
  const field = provider === "google" ? "googleId" : "facebookId";
  if (!profile.email && provider === "facebook") {
    throw new AppError("UNAUTHENTICATED", "Ton compte Facebook ne partage pas d'adresse e-mail. Inscris-toi avec ton e-mail.");
  }
  if (!profile.email || !profile.emailVerified) {
    throw new AppError("UNAUTHENTICATED", provider === "google" ? "Ton adresse Google n'est pas vérifiée." : "Ton adresse Facebook n'est pas vérifiée.");
  }
  const email = profile.email.toLowerCase();
  const where = provider === "google" ? { googleId: profile.id } : { facebookId: profile.id };
  const byProvider = await prisma.user.findUnique({ where });
  if (byProvider) {
    if (byProvider.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
    if (byProvider.status === "DELETED") throw new AppError("UNAUTHENTICATED", "Ce compte a été supprimé.");
    return { id: byProvider.id, isNew: false };
  }
  const byEmail = await prisma.user.findUnique({ where: { email } });
  if (byEmail) {
    if (byEmail.status === "SUSPENDED") throw new AppError("ACCOUNT_SUSPENDED", "Ce compte est suspendu.");
    if (byEmail.isDemo || byEmail.status === "DELETED") throw new AppError("CONFLICT", "Cette adresse ne peut pas être utilisée.");
    if (byEmail[field] && byEmail[field] !== profile.id) {
      throw new AppError("CONFLICT", `Cette adresse est déjà reliée à un autre compte ${LABEL[provider]}.`);
    }
    await prisma.user.update({
      where: { id: byEmail.id },
      data: { [field]: profile.id, emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date() },
    });
    return { id: byEmail.id, isNew: false };
  }
  const name = (profile.name ?? email.split("@")[0]).slice(0, 50);
  const create = async (username: string) =>
    prisma.user.create({
      data: {
        email,
        [field]: profile.id,
        emailVerifiedAt: new Date(),
        name: name.length >= 2 ? name : "Membre",
        username,
        // Photo non importée automatiquement : la personne choisit sa photo dans son profil.
      },
    });
  let user;
  try {
    user = await create(await uniqueUsername(email.split("@")[0]));
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Course entre deux connexions simultanées : soit le compte vient d'être créé, soit le pseudo a été pris.
    const again = await prisma.user.findUnique({ where });
    if (again) return { id: again.id, isNew: false };
    user = await create(`membre${Date.now().toString(36)}`);
  }
  return { id: user.id, isNew: true };
}

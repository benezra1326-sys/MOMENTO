import Anthropic from "@anthropic-ai/sdk";

/**
 * Accès à Claude (vision) pour la vérification des profils.
 * - ANTHROPIC_API_KEY : appel direct à l'API Anthropic ;
 * - sinon Vercel AI Gateway, avec AI_GATEWAY_API_KEY ou, sur Vercel, le jeton OIDC du projet
 *   (en-tête x-vercel-oidc-token) : aucune clé à créer.
 * Renvoie null si aucun accès n'est disponible (la demande attend alors l'équipe).
 */
export async function visionClient(): Promise<{ client: Anthropic; model: string } | null> {
  if (process.env.ANTHROPIC_API_KEY) {
    return { client: new Anthropic({ timeout: 45_000, maxRetries: 1 }), model: "claude-opus-5-5" };
  }
  let token = process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || "";
  if (!token) {
    try {
      const { headers } = await import("next/headers");
      token = (await headers()).get("x-vercel-oidc-token") ?? "";
    } catch {
      token = "";
    }
  }
  if (!token) return null;
  return {
    client: new Anthropic({ apiKey: token, baseURL: "https://ai-gateway.vercel.sh", timeout: 45_000, maxRetries: 1 }),
    model: process.env.VISION_MODEL || "anthropic/claude-opus-5.5",
  };
}

/** Extrait le premier objet JSON d'une réponse texte. */
export function parseJsonObject<T>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

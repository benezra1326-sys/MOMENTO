/**
 * DEMO_MODE active les données de démonstration de secours quand la base est
 * injoignable. Il est ignoré en production : une panne de base ne doit jamais
 * être masquée par de fausses données.
 */
export function isDemoMode(): boolean {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_IN_PRODUCTION !== "true") {
    return false;
  }
  return process.env.DEMO_MODE === "true";
}

/**
 * NEXT_PUBLIC_DEMO_LABELS=false : version de test « en conditions réelles », sans badge « Démo »
 * ni bandeau dans l'app. Les comptes fictifs restent marqués isDemo en base (supprimables avant le lancement).
 */
export const demoLabelsVisible = process.env.NEXT_PUBLIC_DEMO_LABELS !== "false";

/**
 * ADMIN_EMAILS (séparées par des virgules) : ces adresses deviennent administrateur
 * dès qu'elles sont vérifiées (connexion Google/Facebook, ou lien de confirmation par e-mail).
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(email.toLowerCase());
}

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

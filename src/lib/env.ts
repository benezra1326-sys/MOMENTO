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

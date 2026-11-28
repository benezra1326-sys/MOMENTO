/** Pages accessibles sans être connecté. Tout le reste de l'app exige une session. */
export const PUBLIC_PATHS = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/nouveau-mot-de-passe", "/verifier-email", "/confidentialite"];

/** Fiche d'un Moment partagé : visible avant l'inscription (sans adresse ni participants). */
const SHARED_MOMENT = /^\/moments\/(?!nouveau$)[A-Za-z0-9_-]+$/;

export function isPublicPath(path: string) {
  return SHARED_MOMENT.test(path) || PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** Pages accessibles sans être connecté. Tout le reste de l'app exige une session. */
export const PUBLIC_PATHS = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/nouveau-mot-de-passe", "/verifier-email", "/confidentialite"];

export function isPublicPath(path: string) {
  return PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

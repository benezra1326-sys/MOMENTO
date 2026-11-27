/**
 * Les notifications sont enregistrées en français (texte figé au moment de l'envoi).
 * Pour les autres langues, on reconnaît le modèle de phrase et on le traduit ; le titre du
 * Moment et les noms restent tels quels.
 */
const en: [RegExp, string][] = [
  [/^(.+) demande à rejoindre « (.+) »\.$/, '$1 asked to join "$2".'],
  [/^(.+) a rejoint « (.+) »\.$/, '$1 joined "$2".'],
  [/^Ta place pour « (.+) » est confirmée\.$/, 'Your spot for "$1" is confirmed.'],
  [/^L'hôte n'a pas pu accepter ta demande pour « (.+) »\.$/, 'The host couldn\'t accept your request for "$1".'],
  [/^(.+) t'invite à « (.+) »\.$/, '$1 invited you to "$2".'],
  [/^(.+) a accepté ton invitation à « (.+) »\.$/, '$1 accepted your invitation to "$2".'],
  [/^(.+) a décliné ton invitation à « (.+) »\.$/, '$1 declined your invitation to "$2".'],
  [/^(.+) ne pourra plus venir à « (.+) »\. Une place s'est libérée\.$/, '$1 can no longer come to "$2". A spot opened up.'],
  [/^« (.+) » a été annulé par l'hôte\. Motif : (.+)$/, '"$1" was cancelled by the host. Reason: $2'],
  [/^« (.+) » a été annulé par l'hôte\.$/, '"$1" was cancelled by the host.'],
  [/^« (.+) » a été annulé : l'hôte a supprimé son compte\.$/, '"$1" was cancelled: the host deleted their account.'],
  [/^L'horaire ou le lieu de « (.+) » a changé\.$/, 'The time or place of "$1" changed.'],
];

export function localizeNotification(body: string, locale: string): string {
  if (locale.startsWith("fr")) return body;
  for (const [re, out] of en) if (re.test(body)) return body.replace(re, out);
  return body;
}

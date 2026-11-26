# Architecture de Momento

## Vue d'ensemble

Une seule application Next.js 15 (App Router), déployée sur Vercel (région `cdg1`), avec une base PostgreSQL (Supabase, schéma `momento`, accès par Prisma via le pooler).

```
Navigateur ──> pages React (src/app, src/components)
          └──> routes API fines (src/app/api/**/route.ts)
                    └──> logique métier (src/server/*.ts) ──> Prisma ──> PostgreSQL
                                                         ├──> Vercel Blob (photos)
                                                         └──> Resend / Brevo (e-mails)
```

- **Routes API** : elles ne contiennent pas de logique. `writeRoute` (src/lib/route.ts) contrôle l'origine (CSRF même origine), lit le JSON et transforme les erreurs en réponses normalisées `{ error: { code, message, details } }`.
- **Logique métier** : `src/server/`. Chaque fonction reçoit le `Viewer` (utilisateur courant ou `null`) et vérifie elle-même les droits. Les entrées sont validées par zod (`src/lib/validation.ts`).
- **Erreurs** : `AppError` avec un code (`VALIDATION`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `EMAIL_NOT_VERIFIED`, `ACCOUNT_SUSPENDED`, `INTERNAL`).

## Données (10 tables)

| Table | Rôle |
| --- | --- |
| `User` | Compte. `status` ACTIVE, SUSPENDED ou DELETED. `isDemo` marque les profils fictifs. `emailVerifiedAt` date de confirmation de l'adresse. |
| `Session` | Sessions. L'identifiant est le sha256 du jeton ; le jeton brut ne vit que dans le cookie `httpOnly`. |
| `Moment` | L'événement : visibilité, statut (DRAFT, PUBLISHED, CANCELLED), capacité, lieu, média. |
| `MomentMembership` | Demande (REQUEST) ou invitation (INVITE) d'un membre pour un Moment, et sa réponse. |
| `Notification` | Notifications dans l'app. |
| `Report`, `Block` | Signalements et blocages. |
| `AuditEvent` | Journal des actions de modération. |
| `AuthToken` | Jetons envoyés par e-mail (confirmation d'adresse, mot de passe oublié). Seul le hachage est stocké. |
| `Upload` | Trace de chaque photo envoyée (quota horaire, nettoyage). |

## Authentification

- Mot de passe (scrypt) ou Google (OAuth avec PKCE, voir GOOGLE_SIGN_IN.md). Comptes démo en un clic si `DEMO_MODE`.
- **Confirmation d'adresse** : un lien valable 24 h est envoyé à l'inscription. La page `/verifier-email` demande un clic sur un bouton, pour que les antivirus de messagerie qui ouvrent les liens ne consomment pas le jeton.
- **Mot de passe oublié** : lien valable 1 h, à usage unique. La réponse est identique que l'adresse existe ou non. Après changement, toutes les sessions du compte sont fermées et une nouvelle est ouverte.
- **Jetons** : 32 octets aléatoires, hachés en sha256, usage unique (réclamé de façon atomique), un nouveau jeton invalide les précédents du même type, 3 envois maximum par compte et par heure.
- **Exigence de confirmation** : `REQUIRE_EMAIL_VERIFICATION=true` bloque la création, la publication, les demandes, les invitations et l'acceptation d'invitation tant que l'adresse n'est pas confirmée. Les comptes Google et démo sont considérés comme confirmés. Voir DECISIONS.md pour la raison de ce drapeau.

## Matrice d'accès à un Moment

« Membre accepté » = membership au statut ACCEPTED. Le blocage, dans un sens ou dans l'autre, rend le Moment introuvable (`NOT_FOUND`) pour les deux personnes.

| Visibilité | Dans le feed | Fiche visible par | Rejoindre | Adresse (si « réservée aux participants ») |
| --- | --- | --- | --- | --- |
| PUBLIC | oui | tout le monde | place confirmée tout de suite | hôte et acceptés |
| REQUEST | oui | tout le monde | demande, l'hôte accepte ou refuse | hôte et acceptés |
| PRIVATE | non | quiconque a le lien | demande, l'hôte accepte ou refuse | hôte et acceptés |
| INVITE_ONLY | non | hôte et personnes invitées (`FORBIDDEN` sinon) | sur invitation de l'hôte | hôte et acceptés |
| Brouillon (DRAFT) | non | l'hôte seul (`NOT_FOUND` sinon) | non | hôte |

Un Moment dont l'hôte n'est plus actif est introuvable. La capacité est vérifiée dans une transaction avec verrou de ligne (`SELECT … FOR UPDATE`). Cette matrice est couverte par `tests/auth-media.test.ts` et `tests/moments.test.ts`.

## Suppression de compte

Implémentée dans `deleteMyAccount` (src/server/accounts.ts) :

1. Confirmation en saisissant son pseudo.
2. Les Moments à venir de la personne sont annulés, et leurs participants et demandeurs sont prévenus.
3. Ses demandes et participations en cours sont annulées.
4. Ses notifications et toutes ses sessions sont supprimées.
5. Le compte est anonymisé (e-mail `deleted+<id>@momento.invalid`, nom, bio, ville, centres d'intérêt et mot de passe effacés) et passe en DELETED. La ligne reste pour garder l'intégrité des signalements et du journal de modération.
6. Sa photo de profil est supprimée du stockage.

Les jetons e-mail et la trace des envois sont supprimés en cascade si la ligne `User` est un jour effacée.

## Limites anti-abus

Par compte et par heure : 30 invitations, 20 demandes, 10 signalements, 30 photos, 3 e-mails de compte. Valeurs dans `src/config/product.ts`.

## Mode démo et pannes

`DEMO_MODE` est explicite et coupé en production sauf `ALLOW_DEMO_IN_PRODUCTION=true`. Si la base est injoignable et que le mode démo est actif, le feed s'affiche en lecture seule depuis des données démo, avec un bandeau. Sans mode démo, une panne de base produit une vraie erreur. `/api/health` indique si la base répond.

## Tests et CI

- `npm test` lance des tests d'intégration sur une vraie base PostgreSQL dont le nom contient « test » (garde-fou dans `tests/global-setup.ts` et `resetDb`). Jamais contre la production.
- `.github/workflows/ci.yml` lance lint, types, migrations et tests sur une base PostgreSQL éphémère, puis le build, à chaque PR et à chaque push sur `main`.

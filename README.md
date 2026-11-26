# Momento

Le réseau social des Moments réels : on découvre un Moment, on demande à le rejoindre (ou on est invité), l'hôte accepte, et on se retrouve en vrai.

Stack : Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Prisma 6 · PostgreSQL · zod · vitest.

## Démarrer en local

```bash
npm install
cp .env.example .env          # puis remplis DATABASE_URL
npm run db:deploy             # applique les migrations
npm run db:seed               # 17 profils et 27 Moments fictifs (marqués "démo")
npm run dev                   # http://localhost:3000
```

Comptes démo : bouton « Essayer avec un compte démo » sur la page de connexion, ou mot de passe `momento-demo`. Le compte `moderation` est administrateur (page `/admin`).

Vérifications : `npm run lint`, `npm run typecheck`, `npm test` (base `momento_test` dédiée, jamais la base principale), `npm run build`.

## Variables d'environnement

Toutes sont décrites dans [`.env.example`](.env.example). Les essentielles :

| Variable | Rôle |
| --- | --- |
| `DATABASE_URL` | PostgreSQL. Sur Supabase : chaîne pooler (port 6543), `?pgbouncer=true&sslmode=require`. |
| `DEMO_MODE` | Active la connexion démo en un clic et le bandeau démo. |
| `ALLOW_DEMO_IN_PRODUCTION` | Obligatoire pour garder le mode démo en production. Sinon il est coupé. |
| `APP_URL` | URL publique, utilisée pour le retour Google. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Active « Continuer avec Google ». Voir [docs/GOOGLE_SIGN_IN.md](docs/GOOGLE_SIGN_IN.md). |
| `PILOT_CITY`, `DEFAULT_TIMEZONE` | Ville pilote et fuseau par défaut. |
| `FEATURE_*` | Fonctions en attente de décision (disponibilités, posts, messagerie, QR). |

### Mode démo et pannes

- Le mode démo est explicite (`DEMO_MODE`) et coupé en production sauf `ALLOW_DEMO_IN_PRODUCTION=true`.
- Si la base est injoignable **et** que le mode démo est actif, le feed et les fiches s'affichent en lecture seule depuis des données démo, avec un bandeau visible. Sans mode démo, une panne de base produit une vraie erreur : rien n'est masqué.
- `/api/health` dit si la base répond.

## Ce qui est en place

- **Feed** : cartes image, vidéo (lecture seulement à l'écran, muette, respecte « réduire les animations » et l'économie de données) et texte ; filtres date, ville, catégorie ; pagination par curseur ; états vides et erreurs.
- **Moments** : création, brouillon, publication, modification, annulation avec motif. Quatre visibilités : public (rejoindre direct), sur demande, sur invitation, privé (lien).
- **Participation** : demande avec message, invitation par pseudo, acceptation ou refus, retrait. La capacité est vérifiée dans une transaction avec verrou de ligne : deux acceptations simultanées ne peuvent pas dépasser la jauge (testé).
- **Adresse protégée** : visible seulement par l'hôte et les participants confirmés si l'hôte le choisit.
- **Profils**, réglages, suppression de compte (anonymisation), **invitations**, **notifications**.
- **Sécurité** : blocage, signalement, modération admin avec journal d'audit, limites de fréquence, CSRF même-origine, sessions hachées en base, mots de passe scrypt, médias ré-encodés en WebP (EXIF supprimés).
- **Connexion Google** (OAuth avec PKCE) : prête, s'active dès que les identifiants sont posés.

## Limites connues

- Upload de médias : stockage local en dev uniquement. En production, il faut brancher un stockage (Supabase Storage ou Vercel Blob) avant d'ouvrir l'upload.
- Pas d'e-mails (vérification d'adresse, mot de passe oublié) ni de notifications push.
- Pas de messagerie, de carte ni de géolocalisation : en attente de décision produit.

## Structure

```
prisma/            schéma, migrations, seed démo
src/app/           pages et routes API (fines)
src/server/        logique métier : moments, participations, sécurité, comptes, Google
src/lib/           auth, erreurs, validation, temps/fuseaux, client API
src/components/    interface
src/config/        réglages produit et drapeaux
tests/             tests d'intégration sur vraie base
scripts/           diagnostic base, génération des visuels démo
```

## Décisions encore ouvertes (derrière config ou drapeaux)

- Ville pilote (Marbella par défaut, `PILOT_CITY`).
- Disponibilités « je suis libre ce soir », posts, messagerie, QR d'arrivée (`FEATURE_*`).
- Stockage des médias en production.
- Âge minimum et vérification d'identité.

## Marketing (pour plus tard)

La priorité est l'application. Pistes de vidéos à reprendre au moment du lancement :

- **A. « Le soir où »** : un plan-séquence d'une soirée née d'un Moment, de la carte dans le feed jusqu'aux rires autour de la table.
- **B. « Avant / après »** : le même dimanche, seul sur le canapé puis au padel avec trois inconnus devenus potes.
- **C. « L'hôte »** : quelqu'un crée un Moment en 30 secondes, reçoit des demandes, choisit, et accueille.
- **D. « Une ville, 24 h de Moments »** : montage rapide de Moments réels d'une même journée dans la ville pilote.

Les visuels démo de l'app sont des illustrations générées, pas des personnes réelles.

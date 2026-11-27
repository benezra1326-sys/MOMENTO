# Activer « Continuer avec Facebook »

Le code est prêt (`src/server/facebook.ts`). Il faut créer une app chez Meta et poser deux variables sur Vercel.

## 1. Chez Meta

1. https://developers.facebook.com/apps/creation/ → cas d'usage **« Authentifier et demander des données aux utilisateurs avec Facebook Login »**, nom « Momento ».
2. Cas d'usage → Facebook Login → **Personnaliser** : ajouter l'autorisation `email` (en plus de `public_profile`).
3. Facebook Login → **Paramètres** → **URI de redirection OAuth valides** :
   - `https://momento-jade-nu.vercel.app/api/auth/facebook/callback`
   - `https://momento-en.vercel.app/api/auth/facebook/callback`
   Laisser « Connexion OAuth Web » et « Mode strict pour les URI de redirection » activés.
4. Paramètres de l'app → **Général** : URL de la politique de confidentialité, catégorie, icône. Noter **ID de l'app** et **Clé secrète**.
5. Passer l'app en mode **Live** (« Publier »). En mode développement, seuls les comptes ajoutés comme testeurs peuvent se connecter.

## 2. Sur Vercel

| Nom | Valeur |
| --- | --- |
| `FACEBOOK_APP_ID` | l'ID de l'app |
| `FACEBOOK_APP_SECRET` | la clé secrète (type « Sensitive ») |

Puis redéployer. Le bouton Facebook apparaît sur les pages de connexion et d'inscription.

## Comportement

- Le jeton est vérifié auprès de Facebook (`debug_token`, bon `app_id`), et les appels portent `appsecret_proof`.
- Un compte Facebook sans adresse e-mail est refusé avec un message clair (s'inscrire par e-mail).
- Un compte existant avec la même adresse est relié (jamais un compte démo). Un même compte peut avoir Google et Facebook.
- Version de l'API : `v25.0` (valable jusqu'en juillet 2028), modifiable par `FACEBOOK_GRAPH_VERSION`.

# Activer « Continuer avec Google »

Le code est prêt. Il faut seulement créer des identifiants chez Google et les poser sur Vercel.

## 1. Chez Google (5 minutes)

1. Va sur https://console.cloud.google.com/ et crée un projet « Momento » (ou choisis-en un).
2. Menu **API et services → Écran de consentement OAuth** : type « Externe », nom de l'app « Momento », ton e-mail de contact. Champs d'application : `openid`, `email`, `profile`. Publie l'écran (sinon seuls les testeurs ajoutés peuvent se connecter).
3. Menu **API et services → Identifiants → Créer des identifiants → ID client OAuth**.
   - Type : **Application Web**.
   - Origines JavaScript autorisées : `https://momento-avis-projects-c27a3c22.vercel.app`
   - URI de redirection autorisés : `https://momento-avis-projects-c27a3c22.vercel.app/api/auth/google/callback`
   - Si tu ajoutes un nom de domaine plus tard, ajoute aussi `https://<ton-domaine>/api/auth/google/callback`.
4. Google affiche un **ID client** et un **code secret**.

## 2. Sur Vercel

Projet **momento** → **Settings → Environment Variables**, environnement *Production* :

| Nom | Valeur |
| --- | --- |
| `GOOGLE_CLIENT_ID` | l'ID client |
| `GOOGLE_CLIENT_SECRET` | le code secret (type « Sensitive ») |
| `APP_URL` | `https://momento-avis-projects-c27a3c22.vercel.app` |

Puis **Deployments → … → Redeploy**. Le bouton Google apparaît sur les pages de connexion et d'inscription.

## Comportement

- Première connexion : un compte est créé avec le nom et la photo Google.
- Si un compte existe déjà avec le même e-mail **vérifié par Google**, il est relié. Jamais à un compte démo.
- Ne colle jamais le code secret dans un chat ou dans le dépôt.

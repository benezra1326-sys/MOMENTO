# Activer « Continuer avec mon numéro »

Le code est prêt (`src/server/phone.ts`). Les SMS passent par **Twilio Verify** : Twilio génère le code, limite les essais et bloque les envois frauduleux (Fraud Guard).

## Chez Twilio

1. Créer un compte : https://www.twilio.com/try-twilio
2. Passer en compte payant (sinon seuls les numéros vérifiés reçoivent les SMS) : https://console.twilio.com/us1/billing/manage-billing/upgrade
3. Créer le service Verify : https://console.twilio.com/us1/develop/verify/services → **Create new** → Friendly name `Momento`, canal **SMS** coché. Noter le **Service SID** (`VA…`).
4. Pays autorisés : https://console.twilio.com/us1/develop/verify/settings/geo-permissions → n'autoriser que les pays utiles (ex. France, Espagne). Limite le risque de « SMS pumping ».
5. **Account SID** (`AC…`) et **Auth Token** : page d'accueil https://console.twilio.com/ (« Account Info »).

## Sur Vercel

| Nom | Valeur |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | `AC…` |
| `TWILIO_AUTH_TOKEN` | le jeton (type « Sensitive ») |
| `TWILIO_VERIFY_SERVICE_SID` | `VA…` |

Puis redéployer : le bouton apparaît sur la connexion et l'inscription.

## Comportement

- « 06 12 34 56 78 » est lu comme un numéro français ; les autres pays avec l'indicatif (+34…, +972…).
- Nouveau numéro : un compte est créé sans e-mail (nom « Membre »), la personne arrive sur son profil pour le compléter.
- Sans Twilio, en développement, le code est écrit dans la console du serveur.
- Coût : voir https://www.twilio.com/en-us/verify/pricing (frais Verify par vérification réussie + prix du SMS du pays).

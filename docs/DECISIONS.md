# Décisions

Les décisions prises, avec leur raison, et celles encore ouvertes. Les réglages produit sont dans `src/config/product.ts`.

## Prises

| Date | Décision | Pourquoi |
| --- | --- | --- |
| 2026-11 | **Modèle simple** : on crée un Moment, les autres demandent à le rejoindre ou sont invités. | Validé par Avishay après l'audit. Le parcours « je suis dispo » est reporté (`FEATURE_AVAILABILITY=false`). |
| 2026-11 | **Hébergement** : Vercel (région Paris `cdg1`) et Supabase PostgreSQL, schéma `momento` avec un rôle dédié. | Base managée en Europe ; le schéma dédié n'est pas exposé à l'API publique de Supabase. |
| 2026-11 | **Photos sur Vercel Blob** plutôt que Supabase Storage. | L'app tourne déjà sur Vercel et le store se relie au projet sans manipuler de clé de service Supabase (clé qui donne tous les droits sur la base). Le code passe par `storage.ts` : changer de fournisseur ne touche qu'un fichier. |
| 2026-11 | **Photos limitées à 4 Mo**, réduites côté navigateur au-delà de 3,5 Mo. | Les fonctions Vercel refusent les corps de plus de 4,5 Mo. |
| 2026-11 | **Vidéos des membres non ouvertes.** | Poids, transcodage et modération à prévoir. Seules les vidéos démo sont acceptées. |
| 2026-11 | **E-mails avec Resend** (Brevo possible en secours). | Choisi par Avishay. Envoi par API HTTP, sans SMTP. |
| 2026-11 | **Confirmation d'adresse exigée seulement si `REQUIRE_EMAIL_VERIFICATION=true`.** | Sans domaine vérifié, Resend n'envoie qu'à l'adresse du propriétaire du compte : exiger la confirmation bloquerait tous les autres membres. On l'active quand un domaine est vérifié. Les liens partent dès qu'une clé est posée. |
| 2026-11 | **Mode démo explicite** (`DEMO_MODE`, `ALLOW_DEMO_IN_PRODUCTION`). | Les profils fictifs sont marqués « démo » et ne doivent jamais masquer une panne. |
| 2026-11 | **Tests sur une base dédiée** dont le nom contient « test ». | Jamais de test, de remise à zéro ni de seed contre la production. |

## Encore ouvertes

- Ville pilote (`PILOT_CITY`, Marbella par défaut ; une piste Paris est à valider).
- Disponibilités, souvenirs/posts, messagerie, QR d'arrivée (`FEATURE_*`).
- Âge minimum et vérification d'identité (aujourd'hui : case « je suis majeur·e »).
- Domaine d'envoi des e-mails (nécessaire pour activer `REQUIRE_EMAIL_VERIFICATION`).
- Envoi de vidéos par les membres.

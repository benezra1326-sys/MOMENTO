# Médias

## Ce qui est accepté

- **Photos envoyées par les membres** : JPEG, PNG ou WebP, 4 Mo maximum, de 200 à 6000 px de côté. Le navigateur réduit d'abord les photos de plus de 3,5 Mo (2560 px maximum) pour rester sous la limite de 4,5 Mo des fonctions Vercel.
- **Traitement** (src/server/uploads.ts) : orientation corrigée, recadrage (1080×1350 pour une couverture, 512×512 pour un avatar), ré-encodage en WebP. Le ré-encodage supprime toutes les métadonnées, dont la position GPS (testé).
- **Quota** : 30 photos par compte et par heure, compté dans la table `Upload`.
- **Vidéos** : seules les vidéos démo (`/demo/…`) sont acceptées. L'envoi de vidéos par les membres n'est pas ouvert (transcodage, poids et modération à prévoir).

## Où sont stockés les fichiers

Choix du pilote dans `src/server/storage.ts` :

| Pilote | Quand | Où |
| --- | --- | --- |
| `blob` | `BLOB_READ_WRITE_TOKEN` présent (production) | Vercel Blob, accès public, chemin `media/<cover|avatar>/<uuid>.webp`, cache 1 an |
| `local` | développement sans jeton | `public/uploads/…` (perdu à chaque déploiement Vercel : dev uniquement) |
| `none` | production sans jeton | l'envoi est refusé avec un message clair |

`STORAGE_DRIVER` permet de forcer un pilote.

Pour brancher Vercel Blob : Vercel → projet → Storage → créer un Blob store et le relier au projet. Vercel pose alors `BLOB_READ_WRITE_TOKEN`, puis il faut redéployer.

## Quelles URL sont acceptées dans un Moment ou un profil

`isAllowedMediaUrl` (src/lib/media.ts) n'accepte que :

- les visuels démo `/demo/…` (sans `..`) ;
- les fichiers locaux `/uploads/cover|avatar/<uuid>.webp` ;
- les fichiers Vercel Blob en `https://<store>.public.blob.vercel-storage.com/media/…`.

Toute autre URL (site externe, autre chemin, http) est refusée. Next/Image n'est autorisé à optimiser que ces mêmes hôtes (`next.config.ts`).

## Suppression

- Quand un hôte remplace le visuel d'un Moment ou qu'un membre change sa photo, l'ancien fichier est supprimé après l'enregistrement.
- À la suppression d'un compte, sa photo de profil est supprimée.
- Une suppression qui échoue est journalisée sans bloquer l'action : un fichier orphelin vaut mieux qu'une action bloquée.
- Les visuels des Moments passés ou annulés restent en place (ils peuvent encore être affichés dans l'historique).

## Confidentialité

Pas de reconnaissance faciale, pas d'analyse d'image. Les URL Blob sont publiques mais non devinables (UUID aléatoire). Une photo de groupe ou une adresse privée ne doit pas être publiée sans l'accord des personnes. Un contenu de ce type peut être signalé et traité par la modération.

## Vidéos des membres (v2)

- Ouvertes par `FEATURE_MEMBER_VIDEOS` (vrai par défaut). MP4, MOV ou WebM, 60 Mo et 60 secondes maximum, 6 vidéos par compte et par heure.
- En production, le navigateur envoie la vidéo **directement à Vercel Blob** (les fonctions Vercel refusent les corps de plus de 4,5 Mo). `/api/uploads/video` ne fait que vérifier le compte, le quota, le type et le poids, puis délivre un jeton valable pour un seul chemin `media/video/<uuid>.<ext>`.
- Le navigateur vérifie la durée et capture une image vers 1 s, envoyée comme affiche (`posterUrl`, ré-encodée en WebP sans métadonnées).
- Pas de transcodage : MP4 (H.264) se lit partout ; un MOV HEVC d'iPhone peut ne pas se lire sur certains Android.
- Une vidéo ou une affiche remplacée est supprimée du stockage.

# Kit de marque Upclose

Symbole : un U fait de deux traits qui descendent l'un vers l'autre et s'arrêtent juste avant de se toucher.
Le logo complet remplace le U de « Upclose » par ce symbole (police des lettres : Fraunces 600, vectorisée).

## Fichiers
- upclose-logo.svg : logo complet, texte encre, pour fonds clairs
- upclose-logo-light.svg : logo complet, texte crème, pour fonds sombres
- upclose-logo-mono-ink.svg : logo en une seule couleur
- upclose-symbol.svg : symbole seul, fond transparent (dégradés)
- upclose-symbol-mono-ink.svg / upclose-symbol-mono-white.svg : symbole une couleur
- upclose-app-icon.svg / upclose-app-icon-dark.svg : icône d'appli carrée, fond plein (iOS arrondit lui-même)
- upclose-favicon.svg : favicon aux coins arrondis
- icon-1024.png, icon-512.png, icon-192.png, apple-icon.png (180), favicon-48.png, favicon-32.png
- opengraph-image.png : image de partage 1200×630

## Couleurs
Corail #EF6A5A · Magenta #D93D74 · Lilas #9A6CF0 · Violet #6D4FE0 · Encre #1D1626 · Crème #FAF6F0

## Intégration (Next.js)
1. Copier ce dossier dans public/brand/.
2. app/icon.png ← icon-512.png ; app/apple-icon.png ← apple-icon.png ; app/opengraph-image.png ← opengraph-image.png ;
   générer app/favicon.ico à partir de favicon-32.png et favicon-48.png.
3. Manifeste PWA : icônes icon-192.png et icon-512.png, theme_color #FAF6F0.
4. En-tête de l'appli : remplacer l'ancien logo (cercle dégradé avec un M) par upclose-logo.svg,
   ou par upclose-symbol.svg là où la place manque.
5. Supprimer les anciens fichiers de logo.

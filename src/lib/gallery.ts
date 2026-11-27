import gallery from "./demo-gallery.json";

/**
 * Visuels proposés à la création d'un Moment et pour les tuiles Explorer : photos sous licence libre
 * (voir public/demo/CREDITS.md) stockées dans Vercel Blob, sinon illustration locale du même nom.
 */
export function galleryUrl(name: string): string {
  return (gallery as Record<string, string>)[name] ?? `/demo/moments/${name}.webp`;
}

/** Toutes les URL de la galerie (à ne jamais supprimer du stockage : elles sont partagées). */
export const galleryUrls: ReadonlySet<string> = new Set(Object.values(gallery as Record<string, string>));

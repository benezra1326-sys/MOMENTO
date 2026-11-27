/* eslint-disable @next/next/no-img-element -- SVG du kit de marque, servi tel quel depuis public/brand. */

/**
 * Logo Upclose (kit public/brand, voir LISEZMOI.md).
 * - par défaut (`light`) : texte crème, pour le fond sombre de l'appli ;
 * - `light={false}` : texte encre, pour fonds clairs ;
 * - `symbol` : symbole seul, là où la place manque.
 */
export function Logo({ light = true, symbol = false, height = 28 }: { light?: boolean; symbol?: boolean; height?: number }) {
  if (symbol) {
    return <img src="/brand/upclose-symbol.svg" alt="Upclose" height={height} width={Math.round((height * 61) / 69.4)} className="block" />;
  }
  const src = light ? "/brand/upclose-logo-light.svg" : "/brand/upclose-logo.svg";
  return <img src={src} alt="Upclose" height={height} width={Math.round((height * 378.3) / 106)} className="block" />;
}

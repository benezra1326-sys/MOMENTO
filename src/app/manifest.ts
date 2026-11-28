import type { MetadataRoute } from "next";
import { getViewerSafe } from "@/lib/auth";
import { blackThemeOn } from "@/lib/theme";

/** Manifeste PWA : nom, couleurs et icônes Upclose (noir et or pour un membre Black qui a choisi ce thème). */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const black = await blackThemeOn(await getViewerSafe()).catch(() => false);
  if (black) {
    return {
      name: "Upclose Black",
      short_name: "Upclose",
      description: "Des gens comme toi. En vrai.",
      start_url: "/",
      display: "standalone",
      background_color: "#000000",
      theme_color: "#000000",
      icons: [
        { src: "/brand/icon-black-192.png", sizes: "192x192", type: "image/png" },
        { src: "/brand/icon-black-512.png", sizes: "512x512", type: "image/png" },
      ],
    };
  }
  return {
    name: "Upclose",
    short_name: "Upclose",
    description: "Des gens comme toi. En vrai.",
    start_url: "/",
    display: "standalone",
    background_color: "#1D1626",
    theme_color: "#1D1626",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

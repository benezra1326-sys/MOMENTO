import type { MetadataRoute } from "next";

/** Manifeste PWA : nom, couleurs et icônes Upclose. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Upclose",
    short_name: "Upclose",
    description: "Life looks better up close.",
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

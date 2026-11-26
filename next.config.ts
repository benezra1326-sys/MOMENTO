import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Seuls nos propres médias sont affichés : visuels démo (locaux) et fichiers Vercel Blob.
    remotePatterns: [{ protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/media/**" }],
  },
};

export default nextConfig;

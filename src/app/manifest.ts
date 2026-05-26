import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SaPen Annotate",
    short_name: "Annotate",
    description: "Standalone wood-slice annotation for SaPen training data.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "white",
    theme_color: "darkslategray",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MiCaja · BIA Energy",
    short_name: "MiCaja",
    description: "Gestión de caja menor — BIA Energy SAS ESP",
    start_url: "/",
    display: "standalone",
    background_color: "#0b0b0c",
    theme_color: "#0b0b0c",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/logo.png", sizes: "640x640", type: "image/png", purpose: "maskable" },
    ],
  };
}

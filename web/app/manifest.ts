import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ВЕРТА — женский биохакинг",
    short_name: "ВЕРТА",
    description: "Персональный трекер организма с менструальным циклом во главе угла.",
    start_url: "/",
    display: "standalone",
    background_color: "#0B0B0D",
    theme_color: "#0B0B0D",
    lang: "ru",
    orientation: "portrait",
    icons: [
      { src: "/icon", sizes: "192x192", type: "image/png" },
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

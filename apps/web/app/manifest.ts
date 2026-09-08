import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leodis Relay",
    id: '/',
    short_name: "Relay",
    description: "Site reporting for Leodis Developments.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F2F3F1",
    theme_color: "#F2F3F1",
    icons: [
      { src: '/icon-192', sizes:'192x192',type:'image/png' },
      { src: "/icon", sizes: "512x512", type: "image/png" },
    ],
  };
}

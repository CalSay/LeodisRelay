import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Leodis Relay",
    id: '/',
    short_name: "Relay",
    description: "Site reporting for Leodis Developments.",
    // Opens the company picked last time (app/page.tsx); the hub itself stays at "/".
    start_url: "/?open=app",
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

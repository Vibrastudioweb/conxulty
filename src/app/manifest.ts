import type { MetadataRoute } from "next";

// PWA instalable — pedido puntual del usuario (14-nov-2026): "en el login
// debe estar también" el botón "Descargar app" (ya existe en conxulty.com,
// repo vitalud, para pacientes). Este es otro origen (app.conxulty.com),
// necesita su propio manifest/SW — no comparte nada con el de vitalud.
// Next.js App Router sirve este archivo en /manifest.webmanifest y agrega
// el <link rel="manifest"> solo, sin tocar layout.tsx.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Conxulty OS — gestión médica",
    short_name: "Conxulty OS",
    description:
      "Pacientes, citas, consultas, recetas y cobros en un solo lugar.",
    start_url: "/?instalada=1",
    scope: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#0f172a",
    lang: "es",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

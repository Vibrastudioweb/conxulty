"use client";

import { useEffect } from "react";

/**
 * Registra el service worker (public/sw.js) apenas carga la app — requisito
 * de instalabilidad de Chrome, junto con manifest.ts. No renderiza nada;
 * vive en el layout raíz para cubrir toda la app, no solo /login.
 */
export function PwaRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Best-effort: sin SW no hay instalación, el resto de la app sigue igual.
      });
    }
  }, []);

  return null;
}

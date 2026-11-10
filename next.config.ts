import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 10-nov-2026: el médico adjunta la captura del comprobante de pago
      // directo en /ajustes (ya no por WhatsApp) — el límite por defecto
      // de Server Actions es 1MB, insuficiente para una captura de
      // pantalla normal de un teléfono. 4MB deja margen razonable sin
      // abrir la puerta a archivos enormes.
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;

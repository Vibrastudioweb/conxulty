import Link from "next/link";
import { Settings } from "lucide-react";

/**
 * Acceso a /ajustes (Plan, método de pago, facturas — changelog punto 89).
 * El intento anterior de un ícono de ajustes acá (punto 56) se revirtió el
 * mismo día (punto 57) porque la pantalla era de solo lectura, sin nada
 * real que configurar — ver Topbar.tsx. Esta vez sí hay algo real detrás
 * (Plan Pro, pago), así que no debería repetirse ese problema.
 */
export function AjustesButton() {
  return (
    <Link
      href="/ajustes"
      title="Configuración"
      className="inline-flex items-center gap-1.5 text-caption text-text-faint transition hover:text-text-secondary"
    >
      <Settings size={14} aria-hidden="true" />
      <span className="group-data-[collapsed=true]/sidebar:hidden">Configuración</span>
    </Link>
  );
}

import type { ReactNode } from "react";

/**
 * Encabezado de sección dentro de una pantalla (p.ej. "Próxima consulta",
 * "Agenda de hoy" en /hoy). Reemplaza el `<h2 className="text-xs uppercase
 * ...">` que cada pantalla repetía por su cuenta.
 */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-eyebrow font-semibold uppercase tracking-wide text-text-faint">
      {children}
    </h2>
  );
}

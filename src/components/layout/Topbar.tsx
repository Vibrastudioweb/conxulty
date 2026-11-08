import Link from "next/link";
import { Search, Settings } from "lucide-react";
import type { AlertaTopbar } from "@/modules/core/notificaciones";
import { NotificacionesBell } from "./NotificacionesBell";

/**
 * Barra superior de escritorio (lg+), al lado del Sidebar (29-oct-2026 —
 * construida para que lo que se ve en /hoy coincida con la demo, pero con
 * datos y comportamiento reales en vez de decorativos; ver changelog,
 * puntos 2/12/43).
 *
 * Piezas reales:
 * - Búsqueda de pacientes: un <form method="get"> normal hacia
 *   /pacientes?q=..., el mismo mecanismo que ya usa
 *   `(dashboard)/pacientes/page.tsx` — no hay un buscador "global" nuevo
 *   que inventar, solo exponer el que ya existe desde aquí.
 * - Notificaciones: `NotificacionesBell`, compartida con `MobileHeader`.
 * - Ajustes (08-nov-2026, ver changelog punto 56): el icono de engranaje
 *   de la demo SÍ tiene destino real ahora (`/ajustes`) — a diferencia del
 *   icono de cuadrícula de la demo, que se descartó por no tener ninguna
 *   función real detrás (hubiera sido decorativo).
 *
 * Deliberadamente NO hay un chip de usuario/avatar aquí: `Sidebar` ya
 * muestra nombre, correo y cerrar sesión al pie — duplicarlo en el Topbar
 * no sería "más funcional", solo el mismo dato dos veces.
 */
export function Topbar({
  alertas,
  className = "",
}: {
  alertas: AlertaTopbar[];
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-20 flex items-center gap-4 border-b border-border bg-surface/95 px-8 py-3 backdrop-blur print:hidden ${className}`}
    >
      <form method="get" action="/pacientes" className="max-w-sm flex-1">
        <label htmlFor="topbar-buscar-paciente" className="sr-only">
          Buscar paciente
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-faint"
            aria-hidden="true"
          />
          <input
            id="topbar-buscar-paciente"
            type="search"
            name="q"
            placeholder="Buscar paciente…"
            className="w-full rounded-input border border-border bg-background py-2 pl-9 pr-3 text-body-secondary text-text-primary placeholder:text-text-faint focus:border-brand-primary focus:outline-none"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-1">
        <NotificacionesBell alertas={alertas} />
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="rounded-input p-2 text-text-faint transition hover:bg-surface-muted hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
      </div>
    </header>
  );
}

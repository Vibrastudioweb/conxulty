import Link from "next/link";
import { Settings } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/components/ui/LogoutButton";
import type { AlertaTopbar } from "@/modules/core/notificaciones";
import { NotificacionesBell } from "./NotificacionesBell";

/**
 * Header compacto de mobile (oculto en lg+, donde su lugar lo ocupa
 * Sidebar). Sticky para que la marca y la salida de sesión sigan
 * accesibles al hacer scroll dentro de una pantalla larga.
 *
 * `alertas` (29-oct-2026): las mismas notificaciones reales del Topbar de
 * escritorio, vía `NotificacionesBell` — en mobile no hay espacio para el
 * buscador de pacientes en este header compacto (sigue disponible entrando
 * a Pacientes), pero las notificaciones no tienen por qué faltar solo por
 * el viewport.
 *
 * Ajustes (08-nov-2026, punto 56): mismo destino que el engranaje del
 * Topbar de escritorio — sin este ícono, /ajustes quedaría inalcanzable
 * en mobile, que es justo lo que se pidió evitar.
 */
export function MobileHeader({
  alertas,
  className = "",
}: {
  alertas: AlertaTopbar[];
  className?: string;
}) {
  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur print:hidden ${className}`}
    >
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <div className="flex items-center gap-1">
        <NotificacionesBell alertas={alertas} />
        <Link
          href="/ajustes"
          aria-label="Ajustes"
          className="rounded-input p-2 text-text-faint transition hover:bg-surface-muted hover:text-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <Settings size={18} aria-hidden="true" />
        </Link>
        <LogoutButton />
      </div>
    </header>
  );
}

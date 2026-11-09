import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { AjustesButton } from "@/components/ui/AjustesButton";
import type { AlertaTopbar } from "@/modules/core/notificaciones";
import type { RolUsuario } from "@prisma/client";
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
 * El acceso a `/ajustes` (agregado en el punto 56) se REVIRTIÓ el mismo
 * día (punto 57) por ser de solo lectura — vuelve a aparecer acá en el
 * punto 89 con Plan/Pago/Facturas reales detrás (ver `AjustesButton`).
 */
export function MobileHeader({
  alertas,
  rol,
  className = "",
}: {
  alertas: AlertaTopbar[];
  rol: RolUsuario;
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
        {rol === "MEDICO" && <AjustesButton />}
        <LogoutButton />
      </div>
    </header>
  );
}

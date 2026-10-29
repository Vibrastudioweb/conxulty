import Link from "next/link";
import { Bell } from "lucide-react";
import type { AlertaTopbar } from "@/modules/core/notificaciones";

/**
 * Campanita de notificaciones, compartida entre `Topbar` (desktop) y
 * `MobileHeader` (mobile) para que la misma alerta real se vea igual en
 * los dos layouts (29-oct-2026). Ver `obtenerAlertasTopbar` para de dónde
 * sale cada alerta — no hay nada inventado aquí, incluyendo el caso vacío.
 *
 * `<details>` nativo en vez de un menú manejado con `useState`: no
 * necesita JavaScript de cliente ni cerrar al hacer click afuera a mano.
 */
export function NotificacionesBell({ alertas }: { alertas: AlertaTopbar[] }) {
  return (
    <details className="group relative">
      <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full text-text-secondary hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
        <span className="relative">
          <Bell size={18} aria-hidden="true" />
          {alertas.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-semibold leading-none text-white">
              {alertas.length}
            </span>
          )}
        </span>
        <span className="sr-only">Notificaciones</span>
      </summary>

      <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-card border border-border bg-surface py-2 shadow-card sm:w-80">
        {alertas.length === 0 ? (
          <p className="px-4 py-3 text-body-secondary text-text-faint">
            No hay nada pendiente.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {alertas.map((alerta) => (
              <li key={alerta.id}>
                <Link
                  href={alerta.href}
                  className="block px-4 py-3 text-body-secondary text-text-primary hover:bg-surface-muted"
                >
                  <span
                    className={
                      alerta.nivel === "warning"
                        ? "text-warning-text"
                        : "text-info-text"
                    }
                  >
                    {alerta.mensaje}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

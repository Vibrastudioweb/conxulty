import { EmptyState } from "@/components/ui/EmptyState";
import type { listarEventosDelPaciente } from "@/modules/trazabilidad";

type Evento = Awaited<ReturnType<typeof listarEventosDelPaciente>>[number];

function formatearAccion(accion: string) {
  const texto = accion.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function formatearFechaHora(fecha: Date) {
  return fecha.toLocaleString("es", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Primera lectura real de RegistroTrazabilidad en todo el sistema — hasta
 * ahora se escribía en cada acción clínica/administrativa pero nunca se
 * mostraba. Va colapsada al final de la ficha (prioridad más baja): es
 * información de auditoría, no algo que un médico consulte en el día a día.
 */
export function TrazabilidadPacienteSeccion({ eventos }: { eventos: Evento[] }) {
  return (
    <details className="mt-8 border-t border-border pt-4">
      <summary className="cursor-pointer text-body-secondary font-medium text-text-secondary">
        Historial de cambios
      </summary>
      <div className="mt-3">
        {eventos.length === 0 ? (
          <EmptyState compact message="Sin eventos registrados." />
        ) : (
          <ul className="space-y-1.5">
            {eventos.map((evento) => (
              <li key={evento.id} className="text-caption text-text-secondary">
                <span className="text-text-primary">{formatearAccion(evento.accion)}</span>
                {" — "}
                {evento.actor?.nombre ?? "Usuario"} · {formatearFechaHora(evento.fecha)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

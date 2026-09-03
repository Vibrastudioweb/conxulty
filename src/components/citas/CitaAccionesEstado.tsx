import Link from "next/link";
import { Pencil } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { accionesDeEstadoDisponibles, citaEsEditable } from "@/modules/core/citas";
import type { CitaDelDia } from "@/components/citas/CitaCard";

type EstadoAccionable = "CONFIRMADA" | "CANCELADA" | "ATENDIDA" | "NO_ASISTIO";
type ServerAction = (formData: FormData) => void | Promise<void>;

const ETIQUETA_ACCION: Record<EstadoAccionable, string> = {
  CONFIRMADA: "Confirmar",
  CANCELADA: "Cancelar",
  ATENDIDA: "Marcar atendida",
  NO_ASISTIO: "No asistió",
};

const VARIANTE_ACCION: Record<EstadoAccionable, ButtonVariant> = {
  CONFIRMADA: "secondary",
  CANCELADA: "ghost",
  ATENDIDA: "secondary",
  NO_ASISTIO: "ghost",
};

/**
 * Botones de cambio de estado para una cita en la vista Día/Semana de
 * /agenda. Reutiliza accionesDeEstadoDisponibles (modules/core/citas.ts)
 * para no duplicar la matriz de transiciones permitidas en la capa de UI:
 * si el servidor no permitiría la transición, el botón directamente no
 * aparece. Las Server Actions se reciben por prop en vez de importarse
 * aquí, para que este componente de presentación no dependa de la
 * estructura de rutas de app/.
 */
export function CitaAccionesEstado({
  cita,
  volverA,
  acciones,
}: {
  cita: Pick<CitaDelDia, "id" | "estado">;
  volverA: string;
  acciones: Record<EstadoAccionable, ServerAction>;
}) {
  const disponibles = accionesDeEstadoDisponibles(cita.estado);
  const editable = citaEsEditable(cita.estado);

  if (disponibles.length === 0 && !editable) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
      {editable && (
        <Link
          href={`/agenda/${cita.id}/editar?volverA=${encodeURIComponent(volverA)}`}
          className="inline-flex items-center gap-1.5 rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-secondary transition hover:border-brand-primary hover:text-brand-primary"
        >
          <Pencil size={14} aria-hidden="true" />
          Editar
        </Link>
      )}
      {disponibles.map((estado) => (
        <form key={estado} action={acciones[estado]}>
          <input type="hidden" name="citaId" value={cita.id} />
          <input type="hidden" name="volverA" value={volverA} />
          <Button type="submit" variant={VARIANTE_ACCION[estado]} size="sm">
            {ETIQUETA_ACCION[estado]}
          </Button>
        </form>
      ))}
    </div>
  );
}

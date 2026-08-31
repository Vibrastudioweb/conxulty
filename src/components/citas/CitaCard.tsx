import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import type { listarCitasDelDia } from "@/modules/core/citas";

/**
 * Compartido entre /hoy y /agenda para no duplicar el render de una cita ni
 * el mapeo estado -> tono. Los estados son exactamente los de EstadoCita en
 * el schema — no se inventa ninguno.
 */
export const ETIQUETAS_ESTADO_CITA: Record<string, string> = {
  PENDIENTE: "Pendiente",
  CONFIRMADA: "Confirmada",
  ATENDIDA: "Atendida",
  CANCELADA: "Cancelada",
  NO_ASISTIO: "No asistió",
};

export const TONO_ESTADO_CITA: Record<string, BadgeTone> = {
  PENDIENTE: "warning",
  CONFIRMADA: "success",
  ATENDIDA: "info",
  CANCELADA: "danger",
  NO_ASISTIO: "danger",
};

export type CitaDelDia = Awaited<ReturnType<typeof listarCitasDelDia>>[number];

function formatearHora(fecha: Date) {
  return fecha.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function CitaCard({
  cita,
  destacada = false,
}: {
  cita: CitaDelDia;
  destacada?: boolean;
}) {
  return (
    <Card
      href={`/pacientes/${cita.paciente.id}?cita=${cita.id}`}
      highlighted={destacada}
      elevated={destacada}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">
          {formatearHora(cita.fechaHora)} — {cita.paciente.nombre}{" "}
          {cita.paciente.apellido}
        </span>
        <Badge tone={TONO_ESTADO_CITA[cita.estado] ?? "neutral"}>
          {ETIQUETAS_ESTADO_CITA[cita.estado] ?? cita.estado}
        </Badge>
      </div>
      {cita.consulta && (
        <span className="mt-1 block text-xs text-brand-primary">
          {cita.consulta.estado === "EN_CURSO"
            ? "Consulta en curso"
            : "Consulta registrada"}
        </span>
      )}
    </Card>
  );
}

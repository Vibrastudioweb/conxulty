import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETAS_ESTADO_CONSULTA, TONO_ESTADO_CONSULTA } from "./estadoConsulta";
import type { listarConsultasDelPaciente } from "@/modules/core/consultas";

export type ConsultaHistorial = Awaited<
  ReturnType<typeof listarConsultasDelPaciente>
>[number];

function formatearFecha(fecha: Date) {
  return fecha.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Resumen de una consulta pasada — nunca el contenido clínico completo (eso
 * sigue viviendo en /consultas/[id], detrás del enlace).
 */
export function ConsultaHistorialCard({ consulta }: { consulta: ConsultaHistorial }) {
  return (
    <Card href={`/consultas/${consulta.id}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">
          {formatearFecha(consulta.fechaHora)}
        </span>
        <Badge tone={TONO_ESTADO_CONSULTA[consulta.estado] ?? "neutral"}>
          {ETIQUETAS_ESTADO_CONSULTA[consulta.estado] ?? consulta.estado}
        </Badge>
      </div>
      {consulta.motivoConsulta && (
        <p className="mt-1 text-sm text-text-secondary">{consulta.motivoConsulta}</p>
      )}
      {consulta.diagnostico && (
        <p className="mt-1 text-xs text-text-secondary">
          <span className="font-medium">Diagnóstico:</span> {consulta.diagnostico}
        </p>
      )}
      {consulta.medico?.usuario?.nombre && (
        <p className="mt-1 text-xs text-text-secondary">
          {consulta.medico.usuario.nombre}
        </p>
      )}
    </Card>
  );
}

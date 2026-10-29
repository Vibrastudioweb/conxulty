import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ConsultaHistorial } from "@/components/consultas/ConsultaHistorialCard";

/**
 * Tab "Tratamientos" de la ficha (29-oct-2026, ver changelog de la demo
 * punto 6). No es un concepto nuevo del modelo: es el campo real
 * `Consulta.tratamiento` (ya existente, texto libre que el médico llena en
 * /consultas/[id]) filtrado a las consultas que SÍ tienen algo escrito ahí,
 * más recientes primero. A diferencia de "problemas activos" (que la demo
 * sí inventaba sin respaldo en el modelo — ver DECISIÓN del usuario de
 * quitarlo), esto es un dato real que ya se captura, solo que hasta ahora
 * no tenía una vista propia fuera del historial completo de la consulta.
 */
export function TratamientosPacienteSeccion({
  consultas,
}: {
  consultas: ConsultaHistorial[];
}) {
  const conTratamiento = consultas.filter((c) => c.tratamiento);

  if (conTratamiento.length === 0) {
    return <EmptyState compact message="Sin tratamientos registrados." />;
  }

  return (
    <ul className="space-y-2">
      {conTratamiento.map((consulta) => (
        <li key={consulta.id}>
          <Card href={`/consultas/${consulta.id}`} padding="cozy">
            <p className="text-caption text-text-faint">
              {consulta.fechaHora.toLocaleDateString("es", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
            <p className="mt-1 text-body-secondary text-text-primary">
              {consulta.tratamiento}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

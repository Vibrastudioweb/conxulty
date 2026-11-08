"use client";

import { useState } from "react";
import { CitaCard, type CitaDelDia } from "@/components/citas/CitaCard";
import { CitaAccionesEstado } from "@/components/citas/CitaAccionesEstado";
import {
  DetalleCitaPanel,
  type CitaDelDiaConDetalle,
} from "@/components/citas/DetalleCitaPanel";

type EstadoAccionable = "CONFIRMADA" | "CANCELADA" | "ATENDIDA" | "NO_ASISTIO";
type ServerAction = (formData: FormData) => void | Promise<void>;

/**
 * Lista de la vista Día de /agenda con el panel de "Detalle de la cita"
 * (ver changelog punto 60). Variante de `ListaCitasSeleccionable` propia
 * para este contexto porque aquí, a diferencia de /hoy, cada cita sigue
 * mostrando además sus botones de cambio de estado (`CitaAccionesEstado`)
 * debajo de la card — esos botones no se mueven al panel: el usuario pidió
 * un paso intermedio con lo esencial + "Iniciar consulta", no que el panel
 * reemplace las acciones de agenda que ya existían.
 */
export function ListaDiaConDetalle({
  citas,
  volverA,
  acciones,
}: {
  citas: CitaDelDiaConDetalle[];
  volverA: string;
  acciones: Record<EstadoAccionable, ServerAction>;
}) {
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const seleccionada =
    citas.find((cita) => cita.id === seleccionadaId) ?? null;

  return (
    <>
      <ul className="space-y-2">
        {citas.map((cita) => (
          <li key={cita.id}>
            <CitaCard
              cita={cita as CitaDelDia}
              onSeleccionar={(c) => setSeleccionadaId(c.id)}
            />
            <CitaAccionesEstado
              cita={cita}
              volverA={volverA}
              acciones={acciones}
            />
          </li>
        ))}
      </ul>
      <DetalleCitaPanel
        cita={seleccionada}
        onCerrar={() => setSeleccionadaId(null)}
      />
    </>
  );
}

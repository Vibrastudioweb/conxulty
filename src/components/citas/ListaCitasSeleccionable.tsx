"use client";

import { useState } from "react";
import { CitaCard, type CitaDelDia } from "@/components/citas/CitaCard";
import {
  DetalleCitaPanel,
  type CitaDelDiaConDetalle,
} from "@/components/citas/DetalleCitaPanel";

/**
 * Envoltorio de estado para el panel de "Detalle de la cita" (ver changelog
 * punto 60). `CitaCard` sigue siendo la única fuente de verdad del render
 * de una cita (ver su propio comentario de cabecera) — este componente solo
 * agrega el estado de selección que un Server Component no puede tener.
 *
 * Guarda el id seleccionado, no el objeto completo: evita que TypeScript
 * tenga que reconciliar `CitaDelDiaConDetalle` (lo que trae esta lista) con
 * `CitaDelDia` (lo que espera `onSeleccionar` de CitaCard) en el callback.
 */
export function ListaCitasSeleccionable({
  citas,
  variant = "card",
  className,
}: {
  citas: CitaDelDiaConDetalle[];
  variant?: "card" | "row";
  className?: string;
}) {
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const seleccionada =
    citas.find((cita) => cita.id === seleccionadaId) ?? null;

  return (
    <>
      <div className={className}>
        {citas.map((cita) => (
          <CitaCard
            key={cita.id}
            cita={cita as CitaDelDia}
            variant={variant}
            onSeleccionar={(c) => setSeleccionadaId(c.id)}
          />
        ))}
      </div>
      <DetalleCitaPanel
        cita={seleccionada}
        onCerrar={() => setSeleccionadaId(null)}
      />
    </>
  );
}

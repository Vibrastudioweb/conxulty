"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import type { listarCitasDelDiaConDetalle } from "@/modules/core/citas";
import {
  formatearRangoHora,
  ETIQUETAS_ESTADO_CITA,
  ETIQUETAS_MODALIDAD,
  TONO_ESTADO_CITA,
} from "@/components/citas/CitaCard";
import { iniciarConsultaAction } from "@/app/(dashboard)/pacientes/[id]/actions";

export type CitaDelDiaConDetalle = Awaited<
  ReturnType<typeof listarCitasDelDiaConDetalle>
>[number];

function calcularEdad(fechaNacimiento: Date): number {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const todaviaNoCumple =
    hoy.getMonth() < fechaNacimiento.getMonth() ||
    (hoy.getMonth() === fechaNacimiento.getMonth() &&
      hoy.getDate() < fechaNacimiento.getDate());
  if (todaviaNoCumple) edad -= 1;
  return edad;
}

/**
 * Panel de "Detalle de la cita" (ver changelog punto 60: la demo lo
 * llamaba "vista rápida de una consulta seleccionada en el calendario").
 * Es un PASO INTERMEDIO, no un reemplazo de la ficha: muestra lo esencial
 * para decidir sin navegar (alergias, teléfono, nota de agenda, estado) más
 * "Iniciar consulta" (misma acción que ya existe en la ficha del paciente,
 * `iniciarConsultaAction` — no se duplica lógica de negocio) y un link
 * separado a "Ver ficha completa", que sigue siendo el único lugar con el
 * historial, antecedentes, tratamientos, etc.
 *
 * Mismo criterio que la ficha (`citaNoDisponible` en
 * pacientes/[id]/page.tsx) para ocultar "Iniciar consulta": una cita
 * CANCELADA o NO_ASISTIO sin consulta ya abierta no admite iniciar una.
 */
export function DetalleCitaPanel({
  cita,
  onCerrar,
}: {
  cita: CitaDelDiaConDetalle | null;
  onCerrar: () => void;
}) {
  if (!cita) return null;

  const tono = TONO_ESTADO_CITA[cita.estado] ?? "neutral";
  const alergias = cita.paciente.antecedentesMedicos;
  const citaNoDisponible =
    !cita.consulta &&
    (cita.estado === "CANCELADA" || cita.estado === "NO_ASISTIO");

  const identidad = [
    cita.paciente.fechaNacimiento
      ? `${calcularEdad(cita.paciente.fechaNacimiento)} años`
      : null,
    cita.paciente.sexo,
    cita.paciente.documentoIdentidad
      ? `Doc. ${cita.paciente.documentoIdentidad}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center sm:p-4"
      // En mobile el panel ya no queda pegado al borde inferior de la
      // pantalla (reporte del usuario, 08-nov-2026): el `p-3` de arriba le
      // da un margen parejo a los 4 lados, y este padding-bottom extra
      // crece con `env(safe-area-inset-bottom)` en teléfonos con barra/
      // gesto inferior, mismo criterio que ya usa `BottomNav.tsx`.
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {/* Backdrop: cerrar al tocar fuera del panel. */}
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onCerrar}
        className="absolute inset-0 cursor-default"
      />

      <div className="relative z-10 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-card bg-surface p-5 shadow-card sm:max-w-md">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-body-secondary font-medium text-text-secondary">
              {formatearRangoHora(cita.fechaHora, cita.duracionMinutos)} ·{" "}
              {ETIQUETAS_MODALIDAD[cita.modalidad] ?? cita.modalidad}
            </p>
            <h2 className="mt-0.5 text-section-title font-semibold text-text-primary">
              {cita.paciente.nombre} {cita.paciente.apellido}
            </h2>
            {identidad && (
              <p className="mt-0.5 text-caption text-text-secondary">
                {identidad}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="shrink-0 rounded-input p-1 text-text-faint transition hover:bg-surface-muted hover:text-text-secondary"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge tone={tono}>
            {ETIQUETAS_ESTADO_CITA[cita.estado] ?? cita.estado}
          </Badge>
          {cita.consulta && (
            <span className="text-caption text-brand-primary">
              {cita.consulta.estado === "EN_CURSO"
                ? "Consulta en curso"
                : "Consulta registrada"}
            </span>
          )}
        </div>

        {cita.paciente.telefono && (
          <p className="mt-3 text-body-secondary text-text-secondary">
            Tel. {cita.paciente.telefono}
          </p>
        )}

        {cita.motivo && (
          <p className="mt-2 text-body-secondary text-text-secondary">
            <span className="font-medium text-text-primary">Motivo: </span>
            {cita.motivo}
          </p>
        )}

        {cita.notas && (
          <p className="mt-2 text-body-secondary text-text-secondary">
            <span className="font-medium text-text-primary">Nota: </span>
            {cita.notas}
          </p>
        )}

        {alergias.length > 0 && (
          <div className="mt-3">
            <Alert tone="danger" title="Alergias">
              <ul className="mt-0.5 list-inside list-disc">
                {alergias.map((alergia) => (
                  <li key={alergia.id}>{alergia.descripcion}</li>
                ))}
              </ul>
            </Alert>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          {!citaNoDisponible && (
            <form action={iniciarConsultaAction}>
              <input type="hidden" name="pacienteId" value={cita.paciente.id} />
              <input type="hidden" name="citaId" value={cita.id} />
              <Button type="submit">
                {cita.consulta ? "Continuar consulta" : "Iniciar consulta"}
              </Button>
            </form>
          )}
          <Link
            href={`/pacientes/${cita.paciente.id}?cita=${cita.id}`}
            className="text-body-secondary font-semibold text-brand-primary hover:underline"
          >
            Ver ficha completa →
          </Link>
        </div>
      </div>
    </div>
  );
}

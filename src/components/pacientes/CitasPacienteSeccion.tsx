import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ETIQUETAS_ESTADO_CITA,
  ETIQUETAS_MODALIDAD,
  TONO_ESTADO_CITA,
  formatearRangoHora,
} from "@/components/citas/CitaCard";
import { formatearFechaISO } from "@/components/citas/fecha";
import type { listarCitasDelPaciente } from "@/modules/core/citas";

type CitaPaciente = Awaited<ReturnType<typeof listarCitasDelPaciente>>[number];

function formatearFechaLarga(fecha: Date) {
  return fecha.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function FilaCita({ cita }: { cita: CitaPaciente }) {
  const consultaEnCurso = cita.consulta?.estado === "EN_CURSO" ? cita.consulta : null;
  const href = consultaEnCurso
    ? `/consultas/${consultaEnCurso.id}`
    : `/agenda/${cita.id}/editar?volverA=${encodeURIComponent(
        `/agenda?fecha=${formatearFechaISO(cita.fechaHora)}`,
      )}`;
  const tone = consultaEnCurso ? "info" : (TONO_ESTADO_CITA[cita.estado] ?? "neutral");
  const etiqueta = consultaEnCurso
    ? "En curso"
    : (ETIQUETAS_ESTADO_CITA[cita.estado] ?? cita.estado);

  return (
    <Link
      href={href}
      className="-mx-3 flex items-center gap-3 rounded-input px-3 py-2.5 transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-secondary font-medium text-text-primary">
          {formatearFechaLarga(cita.fechaHora)} · {formatearRangoHora(cita.fechaHora, cita.duracionMinutos)}
        </p>
        <p className="truncate text-caption text-text-secondary">
          {cita.medico?.usuario?.nombre ?? "Médico"} ·{" "}
          {ETIQUETAS_MODALIDAD[cita.modalidad] ?? cita.modalidad}
        </p>
      </div>
      <Badge tone={tone}>{etiqueta}</Badge>
    </Link>
  );
}

/**
 * Próximas y anteriores citas del paciente, separadas comparando
 * `fechaHora` contra "ahora" — el dominio (listarCitasDelPaciente) devuelve
 * todo junto, separar es presentación. Limita a 5 en cada lista para no
 * convertir la ficha en una segunda Agenda; el historial completo sigue
 * disponible en /agenda filtrando por ese día si hiciera falta.
 */
export function CitasPacienteSeccion({ citas }: { citas: CitaPaciente[] }) {
  const ahora = new Date();
  const proximas = citas
    .filter((c) => c.fechaHora >= ahora)
    .sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime())
    .slice(0, 5);
  const anteriores = citas.filter((c) => c.fechaHora < ahora).slice(0, 5);

  return (
    <section className="mt-8">
      <SectionLabel>Próximas citas</SectionLabel>
      <div className="mt-2 divide-y divide-border">
        {proximas.length === 0 ? (
          <EmptyState compact message="Sin citas próximas." />
        ) : (
          proximas.map((cita) => <FilaCita key={cita.id} cita={cita} />)
        )}
      </div>

      <div className="mt-6 flex items-baseline justify-between">
        <SectionLabel>Citas anteriores</SectionLabel>
      </div>
      <div className="mt-2 divide-y divide-border">
        {anteriores.length === 0 ? (
          <EmptyState compact message="Sin citas anteriores." />
        ) : (
          anteriores.map((cita) => <FilaCita key={cita.id} cita={cita} />)
        )}
      </div>
    </section>
  );
}

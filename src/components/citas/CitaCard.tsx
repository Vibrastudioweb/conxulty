import Link from "next/link";
import { ArrowRight } from "lucide-react";
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

export function formatearHora(fecha: Date) {
  return fecha.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

export function CitaCard({
  cita,
  destacada = false,
  variant = "card",
}: {
  cita: CitaDelDia;
  destacada?: boolean;
  /** "row": fila de agenda sin card propia (hora alineada + paciente como
   *  elemento principal + estado secundario), pensada para listas densas
   *  como Agenda en /hoy. No usado por /agenda, que sigue con Cards
   *  independientes. Si la consulta de la cita está EN_CURSO, la fila lo
   *  refleja en el badge y enlaza a continuar la consulta en vez de al
   *  perfil del paciente. */
  variant?: "card" | "row";
}) {
  const href = `/pacientes/${cita.paciente.id}?cita=${cita.id}`;

  if (destacada) {
    return (
      <Card href={href} padding="spacious" highlighted elevated className="lg:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-display font-semibold text-text-primary">
              {formatearHora(cita.fechaHora)}
            </p>
            <p className="mt-1.5 text-section-title font-medium text-text-primary">
              {cita.paciente.nombre} {cita.paciente.apellido}
            </p>
            {cita.motivo && (
              <p className="mt-1 text-body-secondary text-text-secondary">
                {cita.motivo}
              </p>
            )}
          </div>
          <Badge tone={TONO_ESTADO_CITA[cita.estado] ?? "neutral"}>
            {ETIQUETAS_ESTADO_CITA[cita.estado] ?? cita.estado}
          </Badge>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
          <span className="text-body-secondary text-text-secondary">
            {cita.consulta
              ? cita.consulta.estado === "EN_CURSO"
                ? "Consulta en curso"
                : "Consulta registrada"
              : "Aún sin iniciar"}
          </span>
          <span className="inline-flex items-center gap-1 text-body font-semibold text-brand-primary">
            Entrar a consulta
            <ArrowRight size={16} aria-hidden="true" />
          </span>
        </div>
      </Card>
    );
  }

  if (variant === "row") {
    const consultaEnCurso =
      cita.consulta?.estado === "EN_CURSO" ? cita.consulta : null;
    const rowHref = consultaEnCurso
      ? `/consultas/${consultaEnCurso.id}`
      : href;
    const tone = consultaEnCurso
      ? "info"
      : (TONO_ESTADO_CITA[cita.estado] ?? "neutral");
    const etiqueta = consultaEnCurso
      ? "En curso"
      : (ETIQUETAS_ESTADO_CITA[cita.estado] ?? cita.estado);

    return (
      <Link
        href={rowHref}
        className="-mx-3 flex items-center gap-4 rounded-input px-3 py-3 transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        <span className="w-14 shrink-0 tabular-nums text-body-secondary font-medium text-text-secondary">
          {formatearHora(cita.fechaHora)}
        </span>
        <span className="flex-1 truncate text-body font-medium text-text-primary">
          {cita.paciente.nombre} {cita.paciente.apellido}
        </span>
        <Badge tone={tone}>{etiqueta}</Badge>
      </Link>
    );
  }

  return (
    <Card href={href}>
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

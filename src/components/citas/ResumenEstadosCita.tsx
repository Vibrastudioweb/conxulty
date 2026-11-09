import type { EstadoCita } from "@prisma/client";
import {
  CalendarDays,
  CalendarClock,
  CheckCircle2,
  UserCheck,
  XCircle,
} from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";

/**
 * Las 5 tarjetas KPI de Agenda llevadas de la demo (29-oct-2026, ver
 * changelog del proyecto, punto 3) con datos reales: se calculan sobre las
 * citas que ya trajo la vista activa (Día/Semana/Mes) — no hay una consulta
 * nueva ni datos de relleno para Semana/Mes, al contrario de lo que hacía
 * la demo (que simulaba "hoy" para Semana/Mes).
 *
 * "Canceladas" cuenta solo `estado === "CANCELADA"` — `NO_ASISTIO` no tiene
 * tarjeta propia (la demo tampoco la tenía) pero sí entra en "Citas
 * programadas" (el total). Si se filtra por estado/modalidad desde
 * FiltrosAgenda, estas 5 tarjetas reflejan ese mismo filtro, no el total
 * sin filtrar — son un resumen de lo que se está viendo, no un KPI aparte.
 */
export function ResumenEstadosCita({
  citas,
}: {
  citas: Array<{ estado: EstadoCita }>;
}) {
  const contar = (estado: EstadoCita) =>
    citas.filter((c) => c.estado === estado).length;

  return (
    <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        icon={CalendarDays}
        label="Citas programadas"
        value={String(citas.length)}
      />
      <KpiCard
        icon={CalendarClock}
        label="Pendientes"
        value={String(contar("PENDIENTE"))}
      />
      <KpiCard
        icon={CheckCircle2}
        label="Confirmadas"
        value={String(contar("CONFIRMADA"))}
      />
      <KpiCard
        icon={UserCheck}
        label="Atendidas"
        value={String(contar("ATENDIDA"))}
      />
      <KpiCard
        icon={XCircle}
        label="Canceladas"
        value={String(contar("CANCELADA"))}
      />
    </section>
  );
}

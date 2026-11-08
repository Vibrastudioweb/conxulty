import Link from "next/link";
import {
  type CitaDelDia,
  formatearHora,
  ETIQUETAS_ESTADO_CITA,
  TONO_ESTADO_CITA,
} from "@/components/citas/CitaCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearFechaISO, sumarDias } from "@/components/citas/fecha";

const ETIQUETA_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Mismo criterio que `CitaCard variant="row"`: si la consulta está
 *  EN_CURSO, el enlace y el tono reflejan eso en vez del estado de la
 *  cita. Se reimplementa aquí (no se reexporta de CitaCard) porque el
 *  layout ya no es compartido — ver nota de arriba. */
function datosTarjeta(cita: CitaDelDia) {
  const consultaEnCurso =
    cita.consulta?.estado === "EN_CURSO" ? cita.consulta : null;
  return {
    href: consultaEnCurso
      ? `/consultas/${consultaEnCurso.id}`
      : `/pacientes/${cita.paciente.id}?cita=${cita.id}`,
    tono: consultaEnCurso
      ? ("info" as const)
      : (TONO_ESTADO_CITA[cita.estado] ?? "neutral"),
    etiqueta: consultaEnCurso
      ? "En curso"
      : (ETIQUETAS_ESTADO_CITA[cita.estado] ?? cita.estado),
  };
}

/**
 * Vista de semana: resumen de solo lectura por día (hora + paciente +
 * estado + modalidad), pensada para ver la carga de la semana de un
 * vistazo. Las acciones de estado y edición quedan en la vista Día — abrir
 * un día concreto es un click en su encabezado.
 *
 * Cada cita se dibuja en una tarjeta propia en VERTICAL (hora / paciente /
 * estado, una debajo de otra) — no reutiliza `CitaCard variant="row"`
 * (08-nov-2026, ver changelog punto 58: esa variante se diseñó para el
 * panel lateral ancho de /hoy, una sola columna; aquí hay 7 columnas en
 * escritorio, mucho más angostas, y la fila horizontal (hora + nombre +
 * badge en una sola línea) no cabía — el texto de la hora y el badge de
 * estado terminaban superpuestos. Apilar verticalmente es a prueba de
 * ancho: nunca se superpone, sin importar cuán angosta sea la columna).
 */
export function VistaSemana({
  inicioSemana,
  citas,
  hoyISO,
}: {
  inicioSemana: Date;
  citas: CitaDelDia[];
  hoyISO: string;
}) {
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(inicioSemana, i));

  const citasPorDia = new Map<string, CitaDelDia[]>();
  for (const cita of citas) {
    const clave = formatearFechaISO(cita.fechaHora);
    const lista = citasPorDia.get(clave) ?? [];
    lista.push(cita);
    citasPorDia.set(clave, lista);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-7 lg:gap-3">
      {dias.map((dia, indice) => {
        const iso = formatearFechaISO(dia);
        const citasDelDia = citasPorDia.get(iso) ?? [];
        const esHoy = iso === hoyISO;

        return (
          <div key={iso} className="min-w-0">
            <Link
              href={`/agenda?vista=dia&fecha=${iso}`}
              className={`block rounded-input px-2 py-1.5 text-center text-caption font-semibold uppercase tracking-wide transition hover:bg-surface-muted ${
                esHoy ? "text-brand-primary" : "text-text-secondary"
              }`}
            >
              {ETIQUETA_DIA[indice]} {dia.getDate()}
            </Link>
            <div className="mt-1 space-y-1">
              {citasDelDia.length === 0 ? (
                <p className="px-2 py-2 text-center text-caption text-text-faint">
                  —
                </p>
              ) : (
                citasDelDia.map((cita) => {
                  const { href, tono, etiqueta } = datosTarjeta(cita);
                  return (
                    <Link
                      key={cita.id}
                      href={href}
                      className="flex flex-col gap-1 rounded-input border border-border bg-surface px-2 py-1.5 transition hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                    >
                      <span className="text-caption font-semibold tabular-nums text-text-primary">
                        {formatearHora(cita.fechaHora)}
                      </span>
                      <span className="truncate text-caption text-text-secondary">
                        {cita.paciente.nombre} {cita.paciente.apellido}
                      </span>
                      <Badge tone={tono}>{etiqueta}</Badge>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
      {citas.length === 0 && (
        <div className="col-span-full">
          <EmptyState message="No hay citas esta semana." />
        </div>
      )}
    </div>
  );
}

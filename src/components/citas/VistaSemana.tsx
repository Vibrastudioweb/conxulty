import Link from "next/link";
import { CitaCard, type CitaDelDia } from "@/components/citas/CitaCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatearFechaISO, sumarDias } from "@/components/citas/fecha";

const ETIQUETA_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/**
 * Vista de semana: resumen de solo lectura por día (hora + paciente +
 * estado + modalidad), pensada para ver la carga de la semana de un
 * vistazo. Las acciones de estado y edición quedan en la vista Día — abrir
 * un día concreto es un click en su encabezado.
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
                citasDelDia.map((cita) => (
                  <CitaCard key={cita.id} cita={cita} variant="row" />
                ))
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

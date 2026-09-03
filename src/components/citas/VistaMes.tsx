import Link from "next/link";
import type { CitaDelDia } from "@/components/citas/CitaCard";
import { formatearFechaISO, inicioSemana, sumarDias } from "@/components/citas/fecha";

const ETIQUETA_DIA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const SEMANAS_EN_GRILLA = 6;

/**
 * Vista de mes: navegación rápida, no detalle. Cada celda es el número del
 * día más un punto por cada cita (hasta 3, para no convertir la grilla en
 * una segunda vista de día) y lleva a la vista Día de esa fecha.
 */
export function VistaMes({
  mesReferencia,
  citas,
  hoyISO,
}: {
  mesReferencia: Date;
  citas: CitaDelDia[];
  hoyISO: string;
}) {
  const inicioGrilla = inicioSemana(
    new Date(mesReferencia.getFullYear(), mesReferencia.getMonth(), 1),
  );
  const mesActual = mesReferencia.getMonth();

  const citasPorDia = new Map<string, CitaDelDia[]>();
  for (const cita of citas) {
    const clave = formatearFechaISO(cita.fechaHora);
    const lista = citasPorDia.get(clave) ?? [];
    lista.push(cita);
    citasPorDia.set(clave, lista);
  }

  const dias = Array.from({ length: SEMANAS_EN_GRILLA * 7 }, (_, i) =>
    sumarDias(inicioGrilla, i),
  );

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-caption font-semibold uppercase tracking-wide text-text-faint">
        {ETIQUETA_DIA.map((etiqueta) => (
          <div key={etiqueta} className="py-1">
            {etiqueta}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {dias.map((dia) => {
          const iso = formatearFechaISO(dia);
          const citasDelDia = citasPorDia.get(iso) ?? [];
          const enMes = dia.getMonth() === mesActual;
          const esHoy = iso === hoyISO;

          return (
            <Link
              key={iso}
              href={`/agenda?vista=dia&fecha=${iso}`}
              className={`flex aspect-square flex-col items-center justify-center gap-1 rounded-input border text-body-secondary transition hover:border-brand-primary ${
                esHoy
                  ? "border-brand-primary bg-brand-primary-soft"
                  : "border-transparent"
              } ${enMes ? "text-text-primary" : "text-text-faint"}`}
            >
              <span className="font-medium">{dia.getDate()}</span>
              {citasDelDia.length > 0 && (
                <span className="flex gap-0.5">
                  {citasDelDia.slice(0, 3).map((cita) => (
                    <span
                      key={cita.id}
                      className="h-1.5 w-1.5 rounded-full bg-brand-primary"
                    />
                  ))}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

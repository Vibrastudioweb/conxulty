const DIAS_UNA_LETRA = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRES_DIA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];

function inicioDeSemana(fecha: Date): Date {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // getDay(): 0=domingo..6=sábado. Queremos que la semana empiece en lunes.
  const diferencia = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - diferencia);
  return copia;
}

/**
 * Tira de los 7 días de una semana (lunes a domingo), con el día de hoy
 * resaltado si cae dentro de esa semana — ver changelog punto 53 (pieza de
 * Bloque 1/punto 2) y 54 (letra única + navegación entre semanas).
 * Puramente visual, sin consulta a base de datos propia: es contexto de
 * ubicación en la semana. `fechaReferencia` (opcional, por defecto `hoy`)
 * es cualquier fecha de la semana que se quiere mostrar — permite navegar
 * a otra semana sin cambiar cuál es "hoy" para el resaltado. Las flechas
 * de navegación, si se pasan, solo cambian QUÉ SEMANA se dibuja aquí; no
 * afectan la agenda del día mostrada debajo (deliberado, "sin
 * complicarlo" — filtrar la agenda por un día elegido en la tira es una
 * pieza aparte, no construida).
 */
export function TiraDiasSemana({
  hoy,
  fechaReferencia,
  hrefSemanaAnterior,
  hrefSemanaSiguiente,
}: {
  hoy: Date;
  fechaReferencia?: Date;
  hrefSemanaAnterior?: string;
  hrefSemanaSiguiente?: string;
}) {
  const inicio = inicioDeSemana(fechaReferencia ?? hoy);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });

  return (
    <div>
      {(hrefSemanaAnterior || hrefSemanaSiguiente) && (
        <div className="mb-1 flex justify-end gap-1">
          {hrefSemanaAnterior && (
            <a
              href={hrefSemanaAnterior}
              aria-label="Semana anterior"
              className="rounded-input p-1 text-text-faint hover:bg-surface-muted hover:text-text-secondary"
            >
              ‹
            </a>
          )}
          {hrefSemanaSiguiente && (
            <a
              href={hrefSemanaSiguiente}
              aria-label="Semana siguiente"
              className="rounded-input p-1 text-text-faint hover:bg-surface-muted hover:text-text-secondary"
            >
              ›
            </a>
          )}
        </div>
      )}
      <div className="flex justify-between gap-1">
        {dias.map((dia, i) => {
          const esHoy = dia.toDateString() === hoy.toDateString();
          return (
            <div
              key={i}
              title={NOMBRES_DIA[i]}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-input py-1.5 text-caption ${
                esHoy
                  ? "bg-brand-primary-soft font-semibold text-brand-primary"
                  : "text-text-faint"
              }`}
            >
              <span aria-hidden="true">{DIAS_UNA_LETRA[i]}</span>
              <span className="sr-only">{NOMBRES_DIA[i]}</span>
              <span
                className={`text-body-secondary font-semibold ${esHoy ? "text-brand-primary" : "text-text-primary"}`}
              >
                {dia.getDate()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

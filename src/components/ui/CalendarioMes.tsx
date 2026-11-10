/**
 * Calendario de mes completo para la columna derecha de /hoy (10-nov-2026,
 * rediseño — pieza que no existía: el panel lateral solo tenía la tira de
 * la semana, `TiraDiasSemana`). Puramente visual, sin navegación entre
 * meses (eso sería otra función no pedida todavía) — muestra el mes en
 * curso, con el día de hoy resaltado y los días del mes
 * anterior/siguiente que completan la cuadrícula en gris, igual que
 * cualquier calendario de mes estándar.
 */

const DIAS_UNA_LETRA = ["L", "M", "X", "J", "V", "S", "D"];
const NOMBRES_MES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function diaSemanaLunesPrimero(fecha: Date): number {
  // getDay(): 0=domingo..6=sábado -> queremos 0=lunes..6=domingo.
  return (fecha.getDay() + 6) % 7;
}

export function CalendarioMes({ hoy }: { hoy: Date }) {
  const año = hoy.getFullYear();
  const mes = hoy.getMonth();
  const primerDiaMes = new Date(año, mes, 1);
  const diasEnMes = new Date(año, mes + 1, 0).getDate();
  const diasEnMesAnterior = new Date(año, mes, 0).getDate();
  const huecosInicio = diaSemanaLunesPrimero(primerDiaMes);

  type Celda = { dia: number; delMesActual: boolean; esHoy: boolean };
  const celdas: Celda[] = [];

  for (let i = huecosInicio - 1; i >= 0; i--) {
    celdas.push({ dia: diasEnMesAnterior - i, delMesActual: false, esHoy: false });
  }
  for (let dia = 1; dia <= diasEnMes; dia++) {
    celdas.push({ dia, delMesActual: true, esHoy: dia === hoy.getDate() });
  }
  while (celdas.length % 7 !== 0) {
    celdas.push({
      dia: celdas.length - huecosInicio - diasEnMes + 1,
      delMesActual: false,
      esHoy: false,
    });
  }

  const nombreMes = NOMBRES_MES[mes];

  return (
    <div>
      <p className="text-body-secondary font-semibold capitalize text-text-primary">
        {nombreMes} {año}
      </p>
      <div className="mt-3 grid grid-cols-7 gap-y-1.5 text-center">
        {DIAS_UNA_LETRA.map((letra) => (
          <span
            key={letra}
            className="text-caption font-semibold text-text-faint"
          >
            {letra}
          </span>
        ))}
        {celdas.map((celda, i) => (
          <span
            key={i}
            className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full text-caption ${
              !celda.delMesActual
                ? "text-text-faint/60"
                : celda.esHoy
                  ? "bg-brand-primary font-semibold text-white"
                  : "text-text-primary"
            }`}
          >
            {celda.dia}
          </span>
        ))}
      </div>
    </div>
  );
}

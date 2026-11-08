const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function inicioDeSemana(fecha: Date): Date {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // getDay(): 0=domingo..6=sábado. Queremos que la semana empiece en lunes.
  const diferencia = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - diferencia);
  return copia;
}

/**
 * Tira de los 7 días de la semana actual (lunes a domingo), con el día de
 * hoy resaltado — ver changelog punto 53 (pieza de Bloque 1/punto 2 que
 * había quedado sin construir). Puramente visual, sin consulta a base de
 * datos: es contexto de ubicación en la semana, no un selector — clic no
 * hace nada todavía (no se pidió navegar a otro día desde aquí).
 */
export function TiraDiasSemana({ hoy }: { hoy: Date }) {
  const inicio = inicioDeSemana(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return dia;
  });

  return (
    <div className="flex justify-between gap-1">
      {dias.map((dia, i) => {
        const esHoy = dia.toDateString() === hoy.toDateString();
        return (
          <div
            key={i}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-input py-1.5 text-caption ${
              esHoy
                ? "bg-brand-primary-soft font-semibold text-brand-primary"
                : "text-text-faint"
            }`}
          >
            <span>{DIAS_CORTOS[i]}</span>
            <span
              className={`text-body-secondary font-semibold ${esHoy ? "text-brand-primary" : "text-text-primary"}`}
            >
              {dia.getDate()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

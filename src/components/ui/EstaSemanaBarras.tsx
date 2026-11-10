/**
 * "Esta semana" como barras de progreso (10-nov-2026, rediseño de /hoy) —
 * reemplaza la tira de navegación `TiraDiasSemana` en el panel lateral:
 * mismo dato real de siempre (citas por día, de `listarCitasEnRango`, ya
 * usado para "Actividad del mes"), agrupado por día de ESTA semana en vez
 * de por día del mes. Pierde la paginación a otras semanas que tenía
 * `TiraDiasSemana` (`?semana=`) — decisión explícita del usuario al pedir
 * igualar el boceto, que no la tenía; `/agenda` sigue siendo la forma de
 * ver otras semanas.
 */
export function EstaSemanaBarras({
  datos,
}: {
  datos: Array<{ letra: string; total: number; esHoy: boolean }>;
}) {
  const max = Math.max(1, ...datos.map((d) => d.total));

  return (
    <div className="flex flex-col gap-2.5">
      {datos.map((d) => (
        <div key={d.letra} className="flex items-center gap-2.5">
          <span
            className={`w-7 shrink-0 text-caption ${d.esHoy ? "font-semibold text-text-primary" : "text-text-secondary"}`}
          >
            {d.letra}
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-full rounded-full ${d.esHoy ? "bg-brand-primary" : "bg-brand-primary-soft"}`}
              style={{ width: `${d.total === 0 ? 0 : Math.max(8, (d.total / max) * 100)}%` }}
            />
          </div>
          <span
            className={`w-4 shrink-0 text-right text-caption ${d.esHoy ? "font-semibold text-text-primary" : "text-text-faint"}`}
          >
            {d.total}
          </span>
        </div>
      ))}
    </div>
  );
}

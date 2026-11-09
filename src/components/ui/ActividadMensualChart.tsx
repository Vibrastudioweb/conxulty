/**
 * "Actividad del mes" — gráfico de barras de citas por día del mes en
 * curso, llevado de la demo (29-oct-2026, ver changelog punto 2/43) pero
 * con datos reales (`listarCitasEnRango` agregado por día, ver
 * hoy/page.tsx) en vez del relleno de la demo.
 *
 * SVG a mano en vez de una librería de charts: el proyecto no tiene una
 * instalada (recharts/visx/d3), y para una sola barra por día un SVG
 * simple no justifica añadir una dependencia nueva — mismo criterio que
 * ya usó la demo para su propio QR.
 */
export function ActividadMensualChart({
  datos,
}: {
  datos: Array<{ dia: number; total: number; esHoy: boolean }>;
}) {
  const max = Math.max(1, ...datos.map((d) => d.total));
  const ancho = 640;
  const alto = 120;
  const paddingInferior = 18;
  const anchoBarra = ancho / datos.length;

  if (datos.every((d) => d.total === 0)) {
    return (
      <p className="text-body-secondary text-text-faint">
        Todavía no hay citas registradas este mes.
      </p>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${ancho} ${alto}`}
      className="h-28 w-full"
      role="img"
      aria-label="Citas por día en el mes en curso"
    >
      {datos.map((d) => {
        const alturaBarra =
          d.total === 0 ? 0 : ((alto - paddingInferior) * d.total) / max;
        const x = (d.dia - 1) * anchoBarra;
        return (
          <g key={d.dia}>
            <rect
              x={x + anchoBarra * 0.18}
              y={alto - paddingInferior - alturaBarra}
              width={anchoBarra * 0.64}
              height={alturaBarra}
              rx={1.5}
              className={
                d.esHoy ? "fill-brand-primary" : "fill-brand-primary-soft"
              }
            />
            {(d.dia === 1 ||
              d.dia % 5 === 0 ||
              d.dia === datos.length ||
              d.esHoy) && (
              <text
                x={x + anchoBarra / 2}
                y={alto - 4}
                textAnchor="middle"
                className={
                  d.esHoy
                    ? "fill-text-primary text-[9px] font-semibold"
                    : "fill-text-faint text-[9px]"
                }
              >
                {d.dia}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

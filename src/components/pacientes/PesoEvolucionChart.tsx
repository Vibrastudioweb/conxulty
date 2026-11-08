/**
 * Mini gráfico de evolución de peso a lo largo de las consultas del
 * paciente (08-nov-2026, ver changelog punto 56) — el único gap real que
 * quedó al comparar Signos Vitales contra la demo: antes solo se mostraba
 * el peso de la consulta más reciente, sin ver si sube, baja o se
 * mantiene. SVG a mano, mismo criterio que `ActividadMensualChart` (el
 * proyecto no tiene una librería de charts instalada).
 */
export function PesoEvolucionChart({
  puntos,
}: {
  /** Ascendente por fecha — quien llama ya filtra y ordena. */
  puntos: Array<{ fecha: Date; pesoKg: number }>;
}) {
  if (puntos.length < 2) return null;

  const ancho = 240;
  const alto = 56;
  const paddingY = 8;
  const pesos = puntos.map((p) => p.pesoKg);
  const min = Math.min(...pesos);
  const max = Math.max(...pesos);
  const rango = max - min || 1;

  const coords = puntos.map((p, i) => {
    const x = (i / (puntos.length - 1)) * ancho;
    const y =
      alto - paddingY - ((p.pesoKg - min) / rango) * (alto - paddingY * 2);
    return { x, y };
  });

  const linea = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const primero = puntos[0];
  const ultimo = puntos[puntos.length - 1];

  return (
    <div>
      <svg
        viewBox={`0 0 ${ancho} ${alto}`}
        className="h-14 w-full"
        role="img"
        aria-label={`Evolución de peso: de ${primero.pesoKg} kilogramos a ${ultimo.pesoKg} kilogramos`}
      >
        <polyline
          points={linea}
          fill="none"
          className="stroke-brand-primary"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map((c, i) => (
          <circle
            key={i}
            cx={c.x}
            cy={c.y}
            r={2.5}
            className="fill-brand-primary"
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-caption text-text-faint">
        <span>
          {primero.fecha.toLocaleDateString("es", {
            day: "numeric",
            month: "short",
          })}{" "}
          · {primero.pesoKg} kg
        </span>
        <span>
          {ultimo.fecha.toLocaleDateString("es", {
            day: "numeric",
            month: "short",
          })}{" "}
          · {ultimo.pesoKg} kg
        </span>
      </div>
    </div>
  );
}

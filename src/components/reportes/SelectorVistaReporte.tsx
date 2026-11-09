import Link from "next/link";

export type VistaReporte = "dia" | "semana" | "mes" | "rango";

const OPCIONES: { valor: VistaReporte; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Día" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
  { valor: "rango", etiqueta: "Rango" },
];

/**
 * Mismo patrón que `SelectorVista` de Agenda (enlaces reales a
 * `?vista=...`, sin JS de cliente) — ver changelog punto 17/44. La fecha
 * de referencia se preserva tal cual: cada vista reinterpreta la misma
 * `fecha` (día exacto / semana que la contiene / mes que lo contiene), y
 * "rango" ignora `fecha` por completo (usa `desde`/`hasta` propios).
 */
export function SelectorVistaReporte({
  vistaActual,
  fechaISO,
}: {
  vistaActual: VistaReporte;
  fechaISO: string;
}) {
  return (
    <div className="inline-flex rounded-button border border-border p-0.5">
      {OPCIONES.map((opcion) => {
        const activa = opcion.valor === vistaActual;
        return (
          <Link
            key={opcion.valor}
            href={`/reportes?vista=${opcion.valor}&fecha=${fechaISO}`}
            className={`rounded-button px-3 py-1.5 text-caption font-semibold transition ${
              activa
                ? "bg-brand-primary text-white"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {opcion.etiqueta}
          </Link>
        );
      })}
    </div>
  );
}

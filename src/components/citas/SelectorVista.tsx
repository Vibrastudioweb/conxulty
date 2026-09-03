import Link from "next/link";

export type VistaAgenda = "dia" | "semana" | "mes";

const OPCIONES: { valor: VistaAgenda; etiqueta: string }[] = [
  { valor: "dia", etiqueta: "Día" },
  { valor: "semana", etiqueta: "Semana" },
  { valor: "mes", etiqueta: "Mes" },
];

/**
 * Cambia de vista preservando fecha y filtros activos — la fecha de
 * referencia se reinterpreta según la vista (día exacto / semana que la
 * contiene / mes que la contiene), así que no hace falta recalcularla aquí.
 */
export function SelectorVista({
  vistaActual,
  queryBase,
}: {
  vistaActual: VistaAgenda;
  queryBase: URLSearchParams;
}) {
  return (
    <div className="inline-flex rounded-button border border-border p-0.5">
      {OPCIONES.map((opcion) => {
        const params = new URLSearchParams(queryBase);
        params.set("vista", opcion.valor);
        const activa = opcion.valor === vistaActual;
        return (
          <Link
            key={opcion.valor}
            href={`/agenda?${params.toString()}`}
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

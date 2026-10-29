import Link from "next/link";

export type TabFicha =
  | "resumen"
  | "datos"
  | "antecedentes"
  | "historial"
  | "tratamientos"
  | "citas"
  | "documentos"
  | "ia";

const OPCIONES: { valor: TabFicha; etiqueta: string }[] = [
  { valor: "resumen", etiqueta: "Resumen" },
  { valor: "datos", etiqueta: "Datos personales" },
  { valor: "antecedentes", etiqueta: "Antecedentes" },
  { valor: "historial", etiqueta: "Historial clínico" },
  { valor: "tratamientos", etiqueta: "Tratamientos" },
  { valor: "citas", etiqueta: "Citas" },
  { valor: "documentos", etiqueta: "Estudios y documentos" },
  { valor: "ia", etiqueta: "IA" },
];

/**
 * Las 8 tabs de la ficha, llevadas de la demo (29-oct-2026, ver changelog
 * punto 6) — mismo patrón que `SelectorVista` en Agenda: enlaces reales a
 * `?tab=...`, sin JavaScript de cliente, nada que romper al recargar o
 * compartir el enlace. Scroll horizontal en mobile (8 tabs no caben en un
 * viewport angosto) en vez de envolver o truncar etiquetas.
 */
export function TabsFicha({
  tabActual,
  pacienteId,
}: {
  tabActual: TabFicha;
  pacienteId: string;
}) {
  return (
    <div className="mt-4 flex gap-1 overflow-x-auto border-b border-border pb-px">
      {OPCIONES.map((opcion) => {
        const activa = opcion.valor === tabActual;
        return (
          <Link
            key={opcion.valor}
            href={`/pacientes/${pacienteId}?tab=${opcion.valor}`}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-body-secondary font-medium transition ${
              activa
                ? "border-brand-primary text-brand-primary"
                : "border-transparent text-text-secondary hover:text-text-primary"
            }`}
          >
            {opcion.etiqueta}
          </Link>
        );
      })}
    </div>
  );
}

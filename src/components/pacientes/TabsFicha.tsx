import Link from "next/link";

export type TabFicha =
  | "resumen"
  | "datos"
  | "antecedentes"
  | "historial"
  | "tratamientos"
  | "odontograma"
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

/** Odontograma (ver changelog punto 51) solo aplica a Odontólogo — no es
 * una de las 8 tabs fijas, se inserta aparte para no mostrarla a todos. */
const OPCION_ODONTOGRAMA: { valor: TabFicha; etiqueta: string } = {
  valor: "odontograma",
  etiqueta: "Odontograma",
};

/**
 * Las 8 tabs de la ficha, llevadas de la demo (29-oct-2026, ver changelog
 * punto 6) — mismo patrón que `SelectorVista` en Agenda: enlaces reales a
 * `?tab=...`, sin JavaScript de cliente, nada que romper al recargar o
 * compartir el enlace. Las tabs envuelven a una segunda línea cuando no
 * caben (8 tabs no entran en un viewport angosto) en vez de scroll
 * horizontal — antes usaba `overflow-x-auto`, pero el usuario reportó que
 * ese scroll se sentía mal (08-nov-2026).
 */
export function TabsFicha({
  tabActual,
  pacienteId,
  mostrarOdontograma,
}: {
  tabActual: TabFicha;
  pacienteId: string;
  /** Solo true cuando el médico logueado tiene profesión ODONTOLOGO. */
  mostrarOdontograma?: boolean;
}) {
  // Se inserta después de "Antecedentes" (misma posición temática que la
  // demo le da a datos clínicos de examen) — índice 3, antes de
  // "Historial clínico".
  const opciones = mostrarOdontograma
    ? [...OPCIONES.slice(0, 3), OPCION_ODONTOGRAMA, ...OPCIONES.slice(3)]
    : OPCIONES;

  return (
    <div className="mt-4 flex flex-wrap gap-1 border-b border-border pb-px">
      {opciones.map((opcion) => {
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

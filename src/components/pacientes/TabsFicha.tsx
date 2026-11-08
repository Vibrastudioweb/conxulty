import Link from "next/link";
import { SelectorTabsFicha } from "./SelectorTabsFicha";

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

/** `etiqueta` es la versión larga (usada en el selector mobile, donde el
 *  ancho no es un problema porque la lista es vertical); `corta` es la que
 *  se usa en la fila de escritorio, donde sí importa que las 8-9 quepan en
 *  una sola línea. */
const OPCIONES: { valor: TabFicha; etiqueta: string; corta: string }[] = [
  { valor: "resumen", etiqueta: "Resumen", corta: "Resumen" },
  { valor: "datos", etiqueta: "Datos personales", corta: "Datos" },
  { valor: "antecedentes", etiqueta: "Antecedentes", corta: "Antecedentes" },
  { valor: "historial", etiqueta: "Historial clínico", corta: "Historial" },
  { valor: "tratamientos", etiqueta: "Tratamientos", corta: "Tratamientos" },
  { valor: "citas", etiqueta: "Citas", corta: "Citas" },
  { valor: "documentos", etiqueta: "Estudios y documentos", corta: "Documentos" },
  { valor: "ia", etiqueta: "IA", corta: "IA" },
];

/** Odontograma (ver changelog punto 51) solo aplica a Odontólogo — no es
 * una de las 8 tabs fijas, se inserta aparte para no mostrarla a todos. */
const OPCION_ODONTOGRAMA: { valor: TabFicha; etiqueta: string; corta: string } = {
  valor: "odontograma",
  etiqueta: "Odontograma",
  corta: "Odont.",
};

/**
 * Las 8-9 tabs de la ficha, llevadas de la demo (29-oct-2026, ver changelog
 * punto 6). Dos presentaciones según el ancho disponible, en vez de scroll
 * horizontal o de envolver a una segunda línea — ambas probadas y
 * rechazadas por el usuario (08-nov-2026):
 * - Hasta `lg` (el contenedor de la página sigue acotado a `max-w-md` en
 *   ese rango, ver `pacientes/[id]/page.tsx`): `<select>` nativo
 *   (`SelectorTabsFicha`), el patrón mobile estándar para muchas secciones.
 * - Desde `lg` (contenedor `max-w-4xl`, ancho de sobra): fila única con
 *   etiquetas cortas — mismo patrón `<Link>` a `?tab=...` que ya usaba
 *   Agenda (`SelectorVista`), sin JavaScript, nada que romper al recargar o
 *   compartir el enlace.
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
    <div className="mt-4 border-b border-border">
      <div className="pb-3 lg:hidden">
        <SelectorTabsFicha opciones={opciones} tabActual={tabActual} pacienteId={pacienteId} />
      </div>

      <div className="hidden gap-1 pb-px lg:flex">
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
              {opcion.corta}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

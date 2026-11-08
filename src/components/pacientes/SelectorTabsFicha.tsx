"use client";

import type { TabFicha } from "./TabsFicha";

/**
 * Selector de sección de la ficha para pantallas angostas (hasta `lg`, donde
 * el contenedor de la página sigue acotado a `max-w-md` — ver el comentario
 * de layout en `TabsFicha.tsx`). Reemplaza la fila de tabs por un
 * `<select>` nativo: cero scroll, cero wrap a una segunda línea, y el
 * patrón de selector que un usuario de mobile ya conoce de cualquier app.
 *
 * Navega con un GET real a `?tab=...` (mismo destino que los `<Link>` de la
 * fila de escritorio) — funciona sin JavaScript gracias al botón "Ir" en el
 * `<noscript>`; con JavaScript, el cambio de opción envía el formulario
 * solo, sin que el usuario tenga que tocar nada más.
 */
export function SelectorTabsFicha({
  opciones,
  tabActual,
  pacienteId,
}: {
  opciones: { valor: TabFicha; etiqueta: string }[];
  tabActual: TabFicha;
  pacienteId: string;
}) {
  return (
    <form method="get" action={`/pacientes/${pacienteId}`} className="flex items-center gap-2">
      <select
        name="tab"
        defaultValue={tabActual}
        onChange={(evento) => evento.currentTarget.form?.requestSubmit()}
        className="w-full rounded-input border border-border bg-surface px-3 py-2 text-body-secondary font-medium text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.etiqueta}
          </option>
        ))}
      </select>
      <noscript>
        <button
          type="submit"
          className="shrink-0 rounded-button border border-border px-3 py-2 text-body-secondary font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary"
        >
          Ir
        </button>
      </noscript>
    </form>
  );
}

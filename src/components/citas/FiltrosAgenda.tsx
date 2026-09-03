import { ETIQUETAS_ESTADO_CITA, ETIQUETAS_MODALIDAD } from "@/components/citas/CitaCard";
import type { VistaAgenda } from "@/components/citas/SelectorVista";

const CLASE_SELECT =
  "rounded-input border border-border bg-surface px-2.5 py-1.5 text-caption text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary";

/**
 * Filtros mínimos de agenda (estado, modalidad) — GET sin JavaScript, mismo
 * patrón que el buscador de paciente en /agenda/nueva. No incluye selector
 * de médico: MEDICO/ADMIN/STAFF no comparten pantalla en la arquitectura
 * actual (ver navigation/nav-config.ts), así que hoy /agenda siempre
 * muestra la agenda del médico autenticado.
 */
export function FiltrosAgenda({
  vista,
  fecha,
  estado,
  modalidad,
}: {
  vista: VistaAgenda;
  fecha: string;
  estado?: string;
  modalidad?: string;
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="vista" value={vista} />
      <input type="hidden" name="fecha" value={fecha} />

      <select name="estado" defaultValue={estado ?? ""} className={CLASE_SELECT}>
        <option value="">Todos los estados</option>
        {Object.entries(ETIQUETAS_ESTADO_CITA).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <select name="modalidad" defaultValue={modalidad ?? ""} className={CLASE_SELECT}>
        <option value="">Todas las modalidades</option>
        {Object.entries(ETIQUETAS_MODALIDAD).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>
            {etiqueta}
          </option>
        ))}
      </select>

      <button
        type="submit"
        className="rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary"
      >
        Filtrar
      </button>
    </form>
  );
}

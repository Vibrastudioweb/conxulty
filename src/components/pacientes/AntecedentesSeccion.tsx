import { SectionLabel } from "@/components/ui/SectionLabel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { ETIQUETAS_TIPO_ANTECEDENTE, ORDEN_TIPO_ANTECEDENTE } from "./tipoAntecedente";
import type { listarAntecedentesDelPaciente } from "@/modules/core/antecedentes";

type Antecedente = Awaited<ReturnType<typeof listarAntecedentesDelPaciente>>[number];
type ServerAction = (formData: FormData) => void | Promise<void>;

function formatearFecha(fecha: Date) {
  return fecha.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

/** Alergias primero, luego el resto por relevancia clínica (ver
 *  ORDEN_TIPO_ANTECEDENTE); dentro de un mismo tipo, más reciente primero
 *  (orden que ya trae `antecedentes` desde el dominio). */
function ordenarPorRelevancia(antecedentes: Antecedente[]): Antecedente[] {
  return [...antecedentes].sort(
    (a, b) => ORDEN_TIPO_ANTECEDENTE.indexOf(a.tipo) - ORDEN_TIPO_ANTECEDENTE.indexOf(b.tipo),
  );
}

function SelectorTipoAntecedente({ defaultValue }: { defaultValue: string }) {
  return (
    <select
      name="tipo"
      defaultValue={defaultValue}
      className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      {Object.entries(ETIQUETAS_TIPO_ANTECEDENTE).map(([valor, etiqueta]) => (
        <option key={valor} value={valor}>
          {etiqueta}
        </option>
      ))}
    </select>
  );
}

/**
 * Información clínica persistente del paciente. Distinta de la sección
 * Consultas: un AntecedenteMedico se registra una vez y se consulta antes
 * de futuras atenciones (ver AlertaAlergias para el caso de ALERGIA, que
 * además se destaca arriba de la ficha).
 *
 * Edición controlada: solo se listan antecedentes activos (ver
 * listarAntecedentesDelPaciente), así que "Editar" siempre está disponible
 * aquí — uno desactivado deja de aparecer en esta lista y ya no es
 * editable (ver AntecedenteNoEditableError en modules/core/antecedentes.ts).
 */
export function AntecedentesSeccion({
  pacienteId,
  antecedentes,
  crearAction,
  editarAction,
  desactivarAction,
}: {
  pacienteId: string;
  antecedentes: Antecedente[];
  crearAction: ServerAction;
  editarAction: ServerAction;
  desactivarAction: ServerAction;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between">
        <SectionLabel>Antecedentes</SectionLabel>
      </div>

      <div className="mt-3">
        {antecedentes.length === 0 ? (
          <EmptyState compact message="Sin antecedentes registrados." />
        ) : (
          <ul className="space-y-2">
            {ordenarPorRelevancia(antecedentes).map((antecedente) => (
              <li
                key={antecedente.id}
                className="rounded-card border border-border bg-surface px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone={antecedente.tipo === "ALERGIA" ? "danger" : "neutral"}>
                      {ETIQUETAS_TIPO_ANTECEDENTE[antecedente.tipo] ?? antecedente.tipo}
                    </Badge>
                    <p className="mt-1.5 text-body-secondary text-text-primary">
                      {antecedente.descripcion}
                    </p>
                    <p className="mt-1 text-caption text-text-faint">
                      {formatearFecha(antecedente.fecha)}
                      {antecedente.medico?.usuario?.nombre &&
                        ` · ${antecedente.medico.usuario.nombre}`}
                    </p>
                  </div>
                  <form action={desactivarAction}>
                    <input type="hidden" name="pacienteId" value={pacienteId} />
                    <input type="hidden" name="antecedenteId" value={antecedente.id} />
                    <Button type="submit" variant="ghost" size="sm">
                      Desactivar
                    </Button>
                  </form>
                </div>

                <details className="mt-2">
                  <summary className="cursor-pointer text-caption font-medium text-brand-primary">
                    Editar
                  </summary>
                  <form action={editarAction} className="mt-2 space-y-2">
                    <input type="hidden" name="pacienteId" value={pacienteId} />
                    <input type="hidden" name="antecedenteId" value={antecedente.id} />
                    <SelectorTipoAntecedente defaultValue={antecedente.tipo} />
                    <Textarea
                      name="descripcion"
                      rows={2}
                      defaultValue={antecedente.descripcion}
                      required
                    />
                    <Button type="submit" variant="secondary" size="sm">
                      Guardar cambios
                    </Button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-body-secondary font-medium text-brand-primary">
          + Agregar antecedente
        </summary>
        <form action={crearAction} className="mt-3 space-y-3">
          <input type="hidden" name="pacienteId" value={pacienteId} />
          <SelectorTipoAntecedente defaultValue="OBSERVACION" />
          <Textarea name="descripcion" rows={2} placeholder="Descripción" required />
          <Button type="submit" size="sm">
            Guardar antecedente
          </Button>
        </form>
      </details>
    </section>
  );
}

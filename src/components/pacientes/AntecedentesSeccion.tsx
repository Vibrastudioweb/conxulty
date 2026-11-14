import { SectionLabel } from "@/components/ui/SectionLabel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { EmptyState } from "@/components/ui/EmptyState";
import { ETIQUETAS_TIPO_ANTECEDENTE, ORDEN_TIPO_ANTECEDENTE } from "./tipoAntecedente";
import type {
  listarAntecedentesDelPaciente,
  listarAntecedentesInactivos,
} from "@/modules/core/antecedentes";

type Antecedente = Awaited<ReturnType<typeof listarAntecedentesDelPaciente>>[number];
type AntecedenteInactivo = Awaited<ReturnType<typeof listarAntecedentesInactivos>>[number];
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
 * Arriba van los activos, que son los que cuentan para atender. Abajo,
 * plegados, los que ya no: los desactivados a mano (con "Reactivar",
 * porque desactivar es un clic y sobre una alergia ese clic equivocado es
 * un riesgo) y las versiones anteriores de los corregidos (solo lectura:
 * son lo que decía el registro antes de la corrección).
 */
export function AntecedentesSeccion({
  pacienteId,
  antecedentes,
  inactivos,
  crearAction,
  editarAction,
  desactivarAction,
  reactivarAction,
}: {
  pacienteId: string;
  antecedentes: Antecedente[];
  inactivos: AntecedenteInactivo[];
  crearAction: ServerAction;
  editarAction: ServerAction;
  desactivarAction: ServerAction;
  reactivarAction: ServerAction;
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
                    <p className="text-caption text-text-faint">
                      Lo que dice ahora no se borra: queda guardado abajo, en
                      &ldquo;Ya no vigentes&rdquo;.
                    </p>
                    <Button type="submit" variant="secondary" size="sm">
                      Guardar corrección
                    </Button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      {inactivos.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-body-secondary text-text-secondary">
            Ya no vigentes ({inactivos.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {inactivos.map((antecedente) => (
              <li
                key={antecedente.id}
                className="rounded-card border border-border bg-surface-muted px-3 py-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Badge tone="neutral">
                      {ETIQUETAS_TIPO_ANTECEDENTE[antecedente.tipo] ?? antecedente.tipo}
                    </Badge>
                    <p className="mt-1.5 text-body-secondary text-text-secondary">
                      {antecedente.descripcion}
                    </p>
                    <p className="mt-1 text-caption text-text-faint">
                      {antecedente.reemplazadoPorId
                        ? `Versión anterior, corregida el ${formatearFecha(antecedente.updatedAt)}`
                        : `Desactivado el ${formatearFecha(antecedente.updatedAt)}`}
                    </p>
                  </div>
                  {!antecedente.reemplazadoPorId && (
                    <form action={reactivarAction}>
                      <input type="hidden" name="pacienteId" value={pacienteId} />
                      <input type="hidden" name="antecedenteId" value={antecedente.id} />
                      <Button type="submit" variant="ghost" size="sm">
                        Reactivar
                      </Button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </details>
      )}

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

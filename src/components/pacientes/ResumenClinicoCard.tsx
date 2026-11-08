import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Badge } from "@/components/ui/Badge";
import { ETIQUETAS_TIPO_ANTECEDENTE } from "./tipoAntecedente";
import type { listarAntecedentesDelPaciente } from "@/modules/core/antecedentes";

type Antecedente = Awaited<ReturnType<typeof listarAntecedentesDelPaciente>>[number];

/**
 * "Resumen clínico" del Resumen de la ficha (ver changelog punto 62). Las
 * alergias NO se repiten acá: ya tienen su propio banner de alto contraste
 * (`AlertaAlergias`, arriba de todo, en cualquier pestaña) — repetirlas en
 * esta tarjeta sería la misma información dos veces en la misma pantalla.
 * Esta tarjeta es para el resto de los antecedentes activos (enfermedad
 * crónica, medicamento habitual, cirugía, etc.) — lo más cercano, con
 * datos reales, a los "Problemas activos" de la demo. No se inventa un
 * estado "activo/en seguimiento" que el schema no tiene: se muestra el
 * tipo y la descripción tal cual se registraron.
 */
export function ResumenClinicoCard({ antecedentes }: { antecedentes: Antecedente[] }) {
  const relevantes = antecedentes.filter((a) => a.tipo !== "ALERGIA").slice(0, 4);

  return (
    <Card padding="cozy">
      <SectionLabel>Resumen clínico</SectionLabel>
      {relevantes.length === 0 ? (
        <p className="mt-2 text-body-secondary text-text-faint">
          Sin antecedentes relevantes registrados.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {relevantes.map((antecedente) => (
            <li key={antecedente.id} className="flex items-start gap-2">
              <Badge tone="neutral">
                {ETIQUETAS_TIPO_ANTECEDENTE[antecedente.tipo] ?? antecedente.tipo}
              </Badge>
              <span className="text-body-secondary text-text-secondary">
                {antecedente.descripcion}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

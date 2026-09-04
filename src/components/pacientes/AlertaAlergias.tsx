import { Alert } from "@/components/ui/Alert";
import type { listarAntecedentesDelPaciente } from "@/modules/core/antecedentes";

type Antecedente = Awaited<ReturnType<typeof listarAntecedentesDelPaciente>>[number];

/**
 * Banner de alto contraste con las alergias activas del paciente. Vive
 * arriba de todo en la ficha (prioridad 2, justo después de la identidad):
 * es la información que un médico necesita ver ANTES de decidir cualquier
 * indicación, no algo que deba buscar dentro de la sección Antecedentes.
 */
export function AlertaAlergias({ antecedentes }: { antecedentes: Antecedente[] }) {
  const alergias = antecedentes.filter((a) => a.tipo === "ALERGIA");

  if (alergias.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <Alert tone="danger" title="Alergias">
        <ul className="mt-0.5 list-inside list-disc">
          {alergias.map((alergia) => (
            <li key={alergia.id}>{alergia.descripcion}</li>
          ))}
        </ul>
      </Alert>
    </div>
  );
}

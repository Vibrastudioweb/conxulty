import { SectionLabel } from "@/components/ui/SectionLabel";
import { EmptyState } from "@/components/ui/EmptyState";
import { DocumentoResumenCard } from "@/components/documentos/DocumentoResumenCard";
import type { listarDocumentosDelPaciente } from "@/modules/documentos/documentos";

type DocumentoPaciente = Awaited<ReturnType<typeof listarDocumentosDelPaciente>>[number];

/**
 * Documentos de todas las consultas del paciente en un solo lugar — hasta
 * ahora solo eran visibles entrando a cada consulta individual. Reutiliza
 * DocumentoResumenCard (misma tarjeta que /consultas/[id]) para no duplicar
 * el render de un documento.
 */
export function DocumentosPacienteSeccion({ documentos }: { documentos: DocumentoPaciente[] }) {
  return (
    <section className="mt-8">
      <SectionLabel>Documentos</SectionLabel>
      <div className="mt-2">
        {documentos.length === 0 ? (
          <EmptyState compact message="Sin documentos emitidos." />
        ) : (
          <ul className="space-y-2">
            {documentos.map((documento) => (
              <li key={documento.id}>
                <DocumentoResumenCard consultaId={documento.consultaId} documento={documento} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

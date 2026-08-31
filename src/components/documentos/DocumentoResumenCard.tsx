import { Card } from "@/components/ui/Card";
import { ETIQUETAS_TIPO_DOCUMENTO } from "./tipoDocumento";
import type { listarDocumentosDeConsulta } from "@/modules/documentos/documentos";

export type DocumentoResumen = Awaited<
  ReturnType<typeof listarDocumentosDeConsulta>
>[number];

function formatearFecha(fecha: Date) {
  return fecha.toLocaleDateString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function DocumentoResumenCard({
  consultaId,
  documento,
}: {
  consultaId: string;
  documento: DocumentoResumen;
}) {
  return (
    <Card href={`/consultas/${consultaId}/documentos/${documento.id}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-text-primary">
          {ETIQUETAS_TIPO_DOCUMENTO[documento.tipo] ?? documento.tipo}
        </span>
        <span className="text-xs text-text-secondary">
          {formatearFecha(documento.fechaEmision)}
        </span>
      </div>
      {documento.medico?.usuario?.nombre && (
        <p className="mt-1 text-xs text-text-secondary">
          {documento.medico.usuario.nombre}
        </p>
      )}
    </Card>
  );
}

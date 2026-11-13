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
        <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
          {ETIQUETAS_TIPO_DOCUMENTO[documento.tipo] ?? documento.tipo}
          {/* 13-nov-2026: una receta anulada se conserva en la historia,
              así que lo que no puede pasar es que en la lista se vea igual
              que una válida. */}
          {documento.anuladoEn && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900">
              Anulada
            </span>
          )}
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
      {documento.motivoAnulacion && (
        <p className="mt-1 text-xs text-amber-900">{documento.motivoAnulacion}</p>
      )}
    </Card>
  );
}

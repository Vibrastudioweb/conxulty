import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import {
  obtenerDocumento,
  type ContenidoReceta,
} from "@/modules/documentos/documentos";
import { ETIQUETAS_TIPO_DOCUMENTO } from "@/components/documentos/tipoDocumento";
import { PrintButton } from "@/components/documentos/PrintButton";

export default async function DocumentoPage({
  params,
}: {
  params: Promise<{ id: string; documentoId: string }>;
}) {
  // Lectura: cualquier médico de la organización puede ver un documento
  // emitido, aunque no sea quien lo emitió (mismo criterio que Historia
  // Clínica — Bloque D). No hace falta resolverMedicoAutenticado aquí
  // porque no hay ninguna verificación de ownership en la lectura.
  const session = await requireMedico();
  const { id, documentoId } = await params;

  const documento = await obtenerDocumento({
    organizacionId: session.user.organizacionId,
    documentoId,
  });

  if (!documento || documento.consultaId !== id) {
    notFound();
  }

  const contenido = documento.contenido as unknown as ContenidoReceta;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 print:max-w-full print:bg-white print:py-0">
      <div className="print:hidden">
        <Link
          href={`/consultas/${id}`}
          className="text-sm text-brand-primary hover:underline"
        >
          ← Volver a la consulta
        </Link>
      </div>

      <div className="mt-4 rounded-card border border-border bg-surface p-6 print:mt-0 print:rounded-none print:border-none print:p-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-lg font-semibold text-text-primary">
            {ETIQUETAS_TIPO_DOCUMENTO[documento.tipo] ?? documento.tipo}
          </h1>
          <span className="text-xs text-text-secondary">
            {documento.fechaEmision.toLocaleDateString("es", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        </div>

        <dl className="mt-4 space-y-1 text-sm text-text-secondary">
          <div>
            <span className="font-medium text-text-primary">Paciente:</span>{" "}
            {documento.consulta.paciente.nombre}{" "}
            {documento.consulta.paciente.apellido}
          </div>
          <div>
            <span className="font-medium text-text-primary">Médico:</span>{" "}
            {documento.medico.usuario.nombre}
            {documento.medico.especialidad
              ? ` · ${documento.medico.especialidad}`
              : ""}
            {documento.medico.numeroColegiado
              ? ` · Col. ${documento.medico.numeroColegiado}`
              : ""}
          </div>
          <div>
            <span className="font-medium text-text-primary">
              Organización:
            </span>{" "}
            {documento.organizacion.nombre}
          </div>
        </dl>

        <div className="mt-6 space-y-3">
          {contenido.medicamentos.map((medicamento, i) => (
            <div
              key={i}
              className="border-b border-border pb-2 last:border-none"
            >
              <p className="text-sm font-medium text-text-primary">
                {medicamento.nombre}
              </p>
              <p className="text-sm text-text-secondary">
                {medicamento.indicaciones}
              </p>
            </div>
          ))}
        </div>

        {contenido.indicacionesGenerales && (
          <p className="mt-4 text-sm text-text-secondary">
            {contenido.indicacionesGenerales}
          </p>
        )}
      </div>

      <div className="mt-4 print:hidden">
        <PrintButton />
      </div>
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import { planDeOrganizacion, planIncluyeModulo } from "@/modules/suscripcion/plan";
import { PanelSoloPro } from "@/components/suscripcion/PanelSoloPro";
import {
  obtenerDocumento,
  type ContenidoReceta,
} from "@/modules/documentos/documentos";
import { ETIQUETAS_TIPO_DOCUMENTO } from "@/components/documentos/tipoDocumento";
import { PrintButton } from "@/components/documentos/PrintButton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { anularDocumentoAction } from "../anularActions";

export default async function DocumentoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; documentoId: string }>;
  searchParams: Promise<{ anulado?: string; error?: string }>;
}) {
  // Lectura: cualquier médico de la organización puede ver un documento
  // emitido, aunque no sea quien lo emitió (mismo criterio que Historia
  // Clínica — Bloque D). No hace falta resolverMedicoAutenticado aquí
  // porque no hay ninguna verificación de ownership en la lectura.
  const session = await requireMedico();
  if (!planIncluyeModulo(await planDeOrganizacion(session.user.organizacionId), "documentos")) {
    return <PanelSoloPro modulo="documentos" />;
  }
  const { id, documentoId } = await params;
  const { anulado, error } = await searchParams;

  const documento = await obtenerDocumento({
    organizacionId: session.user.organizacionId,
    documentoId,
  });

  if (!documento || documento.consultaId !== id) {
    notFound();
  }

  const contenido = documento.contenido as unknown as ContenidoReceta;
  const estaAnulada = documento.anuladoEn !== null;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 print:max-w-full print:bg-white print:py-0">
      {/* 13-nov-2026 (auditoría del núcleo clínico): una receta anulada
          sigue existiendo —no se borra, para no dejar la historia clínica
          mintiendo— así que lo que no puede pasar es que se vea igual que
          una válida. El sello NO lleva `print:hidden`: si alguien imprime
          una receta anulada, el papel tiene que decirlo. */}
      {estaAnulada && (
        <div className="mb-4 rounded-card border-2 border-amber-500 bg-amber-50 px-4 py-3">
          <p className="text-heading-3 uppercase tracking-wide text-amber-900">Anulada</p>
          <p className="mt-1 text-body-secondary text-amber-900">
            El{" "}
            {documento.anuladoEn?.toLocaleDateString("es", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {documento.motivoAnulacion ? ` · ${documento.motivoAnulacion}` : ""}
          </p>
          <p className="mt-1 text-body-secondary text-amber-900">
            Esta receta no tiene validez. Se conserva como parte de la historia clínica.
          </p>
        </div>
      )}

      {anulado && !estaAnulada && (
        <div className="mb-4 print:hidden">
          <Alert tone="success">Receta anulada.</Alert>
        </div>
      )}
      {error === "sin_motivo" && (
        <div className="mb-4 print:hidden">
          <Alert tone="danger">Escribe por qué se anula. Sin motivo no se anula.</Alert>
        </div>
      )}
      {error === "ya_anulado" && (
        <div className="mb-4 print:hidden">
          <Alert tone="danger">Esta receta ya estaba anulada.</Alert>
        </div>
      )}

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

      {!estaAnulada && (
        <details className="mt-6 rounded-input border border-border px-3 py-2 print:hidden">
          <summary className="cursor-pointer text-body-secondary text-text-secondary">
            Anular esta receta
          </summary>
          <form action={anularDocumentoAction} className="mt-3 space-y-2">
            <input type="hidden" name="documentoId" value={documento.id} />
            <input type="hidden" name="consultaId" value={id} />
            <p className="text-body-secondary text-text-secondary">
              Para cuando se emitió con un error, por ejemplo el medicamento o la dosis
              equivocada. La receta queda en la historia marcada como anulada, con el
              motivo — no se borra, y al imprimirla el papel dice que no vale.
            </p>
            <label className="block">
              <span className="text-body-secondary text-text-secondary">Motivo</span>
              <input
                type="text"
                name="motivoAnulacion"
                required
                maxLength={300}
                placeholder="Dosis equivocada"
                className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-body text-text-primary"
              />
            </label>
            <Button type="submit" variant="secondary" fullWidth>
              Anular receta
            </Button>
          </form>
        </details>
      )}
    </main>
  );
}

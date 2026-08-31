import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerConsulta } from "@/modules/core/consultas";
import { listarDocumentosDeConsulta } from "@/modules/documentos/documentos";
import { guardarConsultaAction, cerrarConsultaAction } from "./actions";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ETIQUETAS_ESTADO_CONSULTA,
  TONO_ESTADO_CONSULTA,
} from "@/components/consultas/estadoConsulta";
import { DocumentoResumenCard } from "@/components/documentos/DocumentoResumenCard";

export default async function ConsultaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string; error?: string }>;
}) {
  const { session, medico } = await requireMedicoSesion();

  const { id } = await params;
  const { guardado, error } = await searchParams;

  const consulta = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId: id,
  });

  if (!consulta) {
    notFound();
  }

  // Lectura: cualquier médico de la organización puede consultar el
  // historial clínico del paciente, aunque la consulta la haya hecho otro
  // médico (decisión de producto — Bloque D). obtenerConsulta ya filtra por
  // organizacionId, así que llegar aquí ya implica misma organización.
  // Escritura: sigue exigiendo ser el médico dueño (sin cambios respecto al
  // Bloque B) — una consulta ajena siempre se ve de solo lectura, nunca con
  // los botones Guardar/Cerrar, aunque esté EN_CURSO.
  const esPropia = consulta.medicoId === medico.id;
  const soloLectura = consulta.estado !== "EN_CURSO" || !esPropia;
  // Emitir un documento se permite en EN_CURSO o CERRADA (nunca ANULADA), y
  // solo al médico dueño de la consulta — es una condición distinta de
  // soloLectura, que además exige EN_CURSO.
  const puedeEmitirDocumento = esPropia && consulta.estado !== "ANULADA";

  const documentos = await listarDocumentosDeConsulta({
    organizacionId: session.user.organizacionId,
    consultaId: consulta.id,
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 pb-24">
      <Link
        href={`/pacientes/${consulta.pacienteId}`}
        className="text-sm text-brand-primary hover:underline"
      >
        ← {consulta.paciente.nombre} {consulta.paciente.apellido}
      </Link>

      <div className="mt-2 flex items-center justify-between">
        <h1 className="font-display text-lg font-semibold text-text-primary">
          Consulta
        </h1>
        <Badge tone={TONO_ESTADO_CONSULTA[consulta.estado] ?? "neutral"}>
          {ETIQUETAS_ESTADO_CONSULTA[consulta.estado] ?? consulta.estado}
        </Badge>
      </div>

      {guardado && (
        <div className="mt-2">
          <Alert tone="success">Guardado.</Alert>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <Alert tone="danger">No se pudo completar la acción.</Alert>
        </div>
      )}

      <form action={guardarConsultaAction} className="mt-4 space-y-6">
        <input type="hidden" name="consultaId" value={consulta.id} />

        <section>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Motivo
          </h2>
          <Textarea
            name="motivoConsulta"
            defaultValue={consulta.motivoConsulta ?? ""}
            disabled={soloLectura}
            rows={2}
            className="mt-1"
          />
        </section>

        <section>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Historia
          </h2>
          <label className="mt-2 block text-xs text-text-secondary">
            Anamnesis
          </label>
          <Textarea
            name="anamnesis"
            defaultValue={consulta.anamnesis ?? ""}
            disabled={soloLectura}
            rows={3}
          />
          <label className="mt-2 block text-xs text-text-secondary">
            Antecedentes
          </label>
          <Textarea
            name="antecedentes"
            defaultValue={consulta.antecedentes ?? ""}
            disabled={soloLectura}
            rows={3}
          />
        </section>

        <section>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Evaluación clínica
          </h2>
          <label className="mt-2 block text-xs text-text-secondary">
            Examen físico
          </label>
          <Textarea
            name="examenFisico"
            defaultValue={consulta.examenFisico ?? ""}
            disabled={soloLectura}
            rows={3}
          />
          <label className="mt-2 block text-xs text-text-secondary">
            Evaluación
          </label>
          <Textarea
            name="evaluacion"
            defaultValue={consulta.evaluacion ?? ""}
            disabled={soloLectura}
            rows={3}
          />
        </section>

        <section>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Diagnóstico
          </h2>
          <Textarea
            name="diagnostico"
            defaultValue={consulta.diagnostico ?? ""}
            disabled={soloLectura}
            rows={2}
            className="mt-1"
          />
        </section>

        <section>
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Tratamiento
          </h2>
          <Textarea
            name="tratamiento"
            defaultValue={consulta.tratamiento ?? ""}
            disabled={soloLectura}
            rows={3}
            className="mt-1"
          />
        </section>

        {!soloLectura && (
          <Button type="submit" variant="secondary" fullWidth>
            Guardar
          </Button>
        )}
      </form>

      {!soloLectura && (
        <form action={cerrarConsultaAction} className="mt-3">
          <input type="hidden" name="consultaId" value={consulta.id} />
          <Button type="submit" fullWidth>
            Cerrar consulta
          </Button>
        </form>
      )}

      <section className="mt-8 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Documentos
          </h2>
          {puedeEmitirDocumento && (
            <Link
              href={`/consultas/${consulta.id}/documentos/nueva`}
              className="text-sm font-medium text-brand-primary hover:underline"
            >
              + Emitir receta
            </Link>
          )}
        </div>
        {documentos.length === 0 ? (
          <div className="mt-2">
            <EmptyState message="Sin documentos emitidos." />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {documentos.map((documento) => (
              <li key={documento.id}>
                <DocumentoResumenCard
                  consultaId={consulta.id}
                  documento={documento}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

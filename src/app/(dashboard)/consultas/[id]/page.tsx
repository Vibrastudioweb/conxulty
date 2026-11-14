import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { planDeOrganizacion, planIncluyeModulo } from "@/modules/suscripcion/plan";
import { PanelSoloPro } from "@/components/suscripcion/PanelSoloPro";
import { obtenerConsulta, listarNotasAclaratorias } from "@/modules/core/consultas";
import { listarDocumentosDeConsulta } from "@/modules/documentos/documentos";
import {
  guardarConsultaAction,
  cerrarConsultaAction,
  anularConsultaAction,
  agregarNotaAclaratoriaAction,
} from "./actions";
import { Textarea } from "@/components/ui/Textarea";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  ETIQUETAS_ESTADO_CONSULTA,
  TONO_ESTADO_CONSULTA,
} from "@/components/consultas/estadoConsulta";
import { DocumentoResumenCard } from "@/components/documentos/DocumentoResumenCard";
import { resolverPlantilla } from "@/modules/consultas/plantillasEspecialidad";
import { LABEL_PROFESION, type ProfesionId } from "@/modules/onboarding/profesiones";
import { RespaldoFormulario } from "@/components/formularios/RespaldoFormulario";

export default async function ConsultaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ guardado?: string; error?: string; nota?: string }>;
}) {
  const { session, medico } = await requireMedicoSesion();
  if (!planIncluyeModulo(await planDeOrganizacion(session.user.organizacionId), "consultas")) {
    return <PanelSoloPro modulo="consultas" />;
  }

  const { id } = await params;
  const { guardado, error, nota: notaAgregada } = await searchParams;

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

  const [documentos, notasAclaratorias] = await Promise.all([
    listarDocumentosDeConsulta({
      organizacionId: session.user.organizacionId,
      consultaId: consulta.id,
    }),
    listarNotasAclaratorias({
      organizacionId: session.user.organizacionId,
      consultaId: consulta.id,
    }),
  ]);

  // Plantilla por especialidad (ver changelog punto 49) — por la
  // profesión/especialidad del médico DUEÑO de la consulta, no de quien la
  // está viendo (un médico distinto solo la ve de solo lectura, nunca la
  // plantilla de su propia especialidad en una consulta ajena).
  const plantilla = resolverPlantilla({
    profesion: consulta.medico.profesion,
    especialidad: consulta.medico.especialidad,
  });
  const valoresEspecialidad = (consulta.camposEspecialidad as Record<string, string> | null) ?? {};
  const tituloPlantilla =
    consulta.medico.profesion === "MEDICO"
      ? consulta.medico.especialidad ?? "la especialidad"
      : LABEL_PROFESION[consulta.medico.profesion as ProfesionId];

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
      {notaAgregada && (
        <div className="mt-4">
          <Alert tone="success">Nota aclaratoria agregada.</Alert>
        </div>
      )}
      {error === "nota_vacia" && (
        <div className="mt-4">
          <Alert tone="danger">Escribe la nota antes de agregarla.</Alert>
        </div>
      )}
      {error === "sin_motivo" && (
        <div className="mt-4">
          <Alert tone="danger">
            Escribe por qué se anula la consulta. Sin motivo no se anula.
          </Alert>
        </div>
      )}
      {error === "no_anulable" && (
        <div className="mt-4">
          <Alert tone="danger">
            Esta consulta ya no se puede anular: una consulta cerrada es parte de la
            historia clínica.
          </Alert>
        </div>
      )}
      {error && error !== "sin_motivo" && error !== "no_anulable" && error !== "nota_vacia" && (
        <div className="mt-2">
          <Alert tone="danger">No se pudo completar la acción.</Alert>
        </div>
      )}

      <form action={guardarConsultaAction} className="mt-4 space-y-6">
        <input type="hidden" name="consultaId" value={consulta.id} />
        {/* Si guardar falla, la página vuelve con ?error y esto repone lo
            tecleado en vez de dejar al médico frente a la nota vieja. */}
        {!soloLectura && (
          <RespaldoFormulario clave={`consulta:${consulta.id}`} restaurar={error === "1"} />
        )}

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
            Signos vitales
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="block text-xs text-text-secondary">
              Presión arterial
              <Input
                name="presionArterial"
                defaultValue={consulta.presionArterial ?? ""}
                disabled={soloLectura}
                placeholder="120/80 mmHg"
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Frecuencia cardíaca (lpm)
              <Input
                type="number"
                name="frecuenciaCardiaca"
                defaultValue={consulta.frecuenciaCardiaca ?? ""}
                disabled={soloLectura}
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Temperatura (°C)
              <Input
                type="number"
                step="0.1"
                name="temperatura"
                defaultValue={consulta.temperatura?.toString() ?? ""}
                disabled={soloLectura}
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Saturación de O₂ (%)
              <Input
                type="number"
                name="saturacionOxigeno"
                defaultValue={consulta.saturacionOxigeno ?? ""}
                disabled={soloLectura}
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Peso (kg)
              <Input
                type="number"
                step="0.1"
                name="pesoKg"
                defaultValue={consulta.pesoKg?.toString() ?? ""}
                disabled={soloLectura}
                className="mt-1"
              />
            </label>
            <label className="block text-xs text-text-secondary">
              Talla (cm)
              <Input
                type="number"
                step="0.1"
                name="tallaCm"
                defaultValue={consulta.tallaCm?.toString() ?? ""}
                disabled={soloLectura}
                className="mt-1"
              />
            </label>
          </div>
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

        {plantilla && (
          <section>
            <h2 className="font-display text-sm font-semibold text-text-primary">
              Campos de {tituloPlantilla}
            </h2>
            <div className="mt-2 space-y-2">
              {plantilla.map((campo) => (
                <div key={campo.id}>
                  <label className="block text-xs text-text-secondary">
                    {campo.label}
                  </label>
                  <Input
                    name={`especialidad_${campo.id}`}
                    defaultValue={valoresEspecialidad[campo.id] ?? ""}
                    disabled={soloLectura}
                    className="mt-1"
                  />
                </div>
              ))}
            </div>
          </section>
        )}

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

        {/* 13-nov-2026 (segunda revisión del núcleo clínico): "Cerrar
            consulta" vivía en un formulario aparte que solo mandaba el id.
            El médico que escribía la nota y pulsaba Cerrar sin pasar antes
            por Guardar cerraba la consulta con lo último guardado —quizá
            nada—, perdía lo tecleado, y una consulta cerrada no se edita
            ni se anula. Ahora es un botón de ESTE formulario: manda todos
            los campos, y la acción guarda antes de cerrar. */}
        {!soloLectura && (
          <Button type="submit" formAction={cerrarConsultaAction} fullWidth>
            Guardar y cerrar consulta
          </Button>
        )}
      </form>

      {/* 13-nov-2026 (auditoría del núcleo clínico): "Iniciar consulta" es
          un clic desde la ficha de un paciente, y la lista es alfabética
          con apellidos que se repiten. Una consulta abierta en el paciente
          equivocado se quedaba para siempre en la historia de alguien que
          nunca fue atendido, porque nada producía el estado ANULADA.

          Va dentro de un <details> cerrado y al final: anular no es lo que
          el médico viene a hacer acá, y un botón suelto al lado de "Cerrar
          consulta" sería otro clic de más para equivocarse. */}
      {!soloLectura && (
        <details className="mt-6 rounded-input border border-border px-3 py-2">
          <summary className="cursor-pointer text-body-secondary text-text-secondary">
            Anular esta consulta
          </summary>
          <form action={anularConsultaAction} className="mt-3 space-y-2">
            <input type="hidden" name="consultaId" value={consulta.id} />
            <p className="text-body-secondary text-text-secondary">
              Para cuando se abrió por error, por ejemplo en el paciente equivocado. La
              consulta queda en la historia marcada como anulada, con el motivo — no se
              borra. Las recetas emitidas en ella quedan anuladas también.
            </p>
            <label className="block">
              <span className="text-body-secondary text-text-secondary">Motivo</span>
              <input
                type="text"
                name="motivoAnulacion"
                required
                maxLength={300}
                placeholder="Se abrió en el paciente equivocado"
                className="mt-1 w-full rounded-input border border-border bg-surface px-3 py-2 text-body text-text-primary"
              />
            </label>
            <Button type="submit" variant="secondary" fullWidth>
              Anular consulta
            </Button>
          </form>
        </details>
      )}

      {/* 13-nov-2026 (segunda revisión del núcleo clínico): una consulta
          cerrada no se edita, pero cerrar con un error no puede ser un
          callejón sin salida. Como en un expediente en papel: no se tacha
          lo escrito, se agrega una nota con fecha. */}
      {consulta.estado === "CERRADA" && (
        <section className="mt-8">
          <h2 className="font-display text-sm font-semibold text-text-primary">
            Notas aclaratorias
          </h2>
          {notasAclaratorias.length === 0 ? (
            <p className="mt-1 text-body-secondary text-text-secondary">
              Esta consulta está cerrada y no se edita. Si algo quedó mal, agrega una
              nota: queda con su fecha, debajo de lo escrito.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {notasAclaratorias.map((nota) => (
                <li
                  key={nota.id}
                  className="rounded-card border border-border bg-surface px-3 py-2"
                >
                  <p className="whitespace-pre-wrap text-body-secondary text-text-primary">
                    {nota.texto}
                  </p>
                  <p className="mt-1 text-caption text-text-faint">
                    {nota.createdAt.toLocaleDateString("es-VE", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {esPropia && (
            <form action={agregarNotaAclaratoriaAction} className="mt-3 space-y-2">
              <input type="hidden" name="consultaId" value={consulta.id} />
              <Textarea
                name="textoAclaratoria"
                rows={3}
                maxLength={4000}
                required
                placeholder="El diagnóstico correcto es…"
              />
              <Button type="submit" variant="secondary" size="sm">
                Agregar nota aclaratoria
              </Button>
              <p className="text-caption text-text-faint">
                Una nota agregada no se puede editar ni borrar.
              </p>
            </form>
          )}
        </section>
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

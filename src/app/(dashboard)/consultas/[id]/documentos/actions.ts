"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerConsulta } from "@/modules/core/consultas";
import { emitirDocumento, type ContenidoReceta } from "@/modules/documentos/documentos";
import { EstadoConsultaInvalidoError } from "@/modules/core/consultas";

const NUMERO_LINEAS_MEDICAMENTO = 4;

const medicamentoSchema = z.object({
  nombre: z.string().trim().min(1),
  indicaciones: z.string().trim().min(1),
});

const recetaSchema = z.object({
  medicamentos: z
    .array(medicamentoSchema)
    .min(1, "Agrega al menos un medicamento."),
  indicacionesGenerales: z.string().trim().nullable(),
});

export async function emitirRecetaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }

  // Mismo patrón que guardarConsultaAction/cerrarConsultaAction: el
  // organizacionId siempre viene de la sesión, y solo el médico dueño de la
  // consulta puede escribir sobre ella — nunca se confía en un medicoId
  // enviado por el cliente.
  const consulta = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });

  if (!consulta || consulta.medicoId !== medico.id) {
    redirect("/hoy");
  }

  const medicamentos: { nombre: string; indicaciones: string }[] = [];
  for (let i = 1; i <= NUMERO_LINEAS_MEDICAMENTO; i++) {
    const nombre = String(formData.get(`medicamentoNombre${i}`) ?? "").trim();
    const indicaciones = String(
      formData.get(`medicamentoIndicaciones${i}`) ?? "",
    ).trim();
    if (nombre || indicaciones) {
      medicamentos.push({ nombre, indicaciones });
    }
  }

  const indicacionesGeneralesCampo = String(
    formData.get("indicacionesGenerales") ?? "",
  ).trim();

  const parseo = recetaSchema.safeParse({
    medicamentos,
    indicacionesGenerales: indicacionesGeneralesCampo || null,
  });

  if (!parseo.success) {
    redirect(`/consultas/${consultaId}/documentos/nueva?error=1`);
  }

  const contenido: ContenidoReceta = parseo.data;

  let documentoId: string;
  try {
    ({ documentoId } = await emitirDocumento({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      consultaId,
      tipo: "RECETA",
      contenido,
    }));
  } catch (err) {
    if (err instanceof EstadoConsultaInvalidoError) {
      redirect(`/consultas/${consultaId}?error=1`);
    }
    throw err;
  }

  redirect(`/consultas/${consultaId}/documentos/${documentoId}`);
}

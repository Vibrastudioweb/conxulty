"use server";

import { redirect } from "next/navigation";
import { requireMedicoSesion, requirePro } from "@/modules/core/autorizacion";
import {
  obtenerConsulta,
  guardarConsulta,
  cerrarConsulta,
  anularConsulta,
  agregarNotaAclaratoria,
  EstadoConsultaInvalidoError,
  type CamposClinicos,
  type CamposVitales,
} from "@/modules/core/consultas";
import { resolverPlantilla } from "@/modules/consultas/plantillasEspecialidad";

function leerCampo(formData: FormData, campo: string): string | null | undefined {
  const valor = formData.get(campo);
  if (valor === null) return undefined;
  const texto = String(valor).trim();
  return texto === "" ? null : texto;
}

/**
 * Igual que leerCampo pero numérico — un campo vacío se guarda como null
 * (no se registró), y un valor no numérico se trata como "no enviado"
 * (undefined) en vez de bloquear el guardado de los demás campos: un
 * signo vital mal tecleado no debería impedir guardar el resto de la nota.
 */
function leerCampoNumerico(formData: FormData, campo: string): number | null | undefined {
  const valor = formData.get(campo);
  if (valor === null) return undefined;
  const texto = String(valor).trim();
  if (texto === "") return null;
  const numero = Number(texto);
  return Number.isFinite(numero) ? numero : undefined;
}

/**
 * Lee los campos clínicos del formulario y los guarda. Compartido por
 * Guardar y por Cerrar: cerrar SIEMPRE guarda antes (ver
 * cerrarConsultaAction), así que las dos acciones tienen que leer el
 * formulario exactamente igual.
 */
async function guardarDesdeFormulario(
  formData: FormData,
  ctx: {
    organizacionId: string;
    actorId: string;
    consultaId: string;
    medico: { profesion: Parameters<typeof resolverPlantilla>[0]["profesion"]; especialidad: string | null };
  },
): Promise<void> {
  const campos: CamposClinicos = {
    motivoConsulta: leerCampo(formData, "motivoConsulta"),
    anamnesis: leerCampo(formData, "anamnesis"),
    antecedentes: leerCampo(formData, "antecedentes"),
    examenFisico: leerCampo(formData, "examenFisico"),
    evaluacion: leerCampo(formData, "evaluacion"),
    diagnostico: leerCampo(formData, "diagnostico"),
    tratamiento: leerCampo(formData, "tratamiento"),
  };

  const vitales: CamposVitales = {
    presionArterial: leerCampo(formData, "presionArterial"),
    frecuenciaCardiaca: leerCampoNumerico(formData, "frecuenciaCardiaca"),
    temperatura: leerCampoNumerico(formData, "temperatura"),
    saturacionOxigeno: leerCampoNumerico(formData, "saturacionOxigeno"),
    pesoKg: leerCampoNumerico(formData, "pesoKg"),
    tallaCm: leerCampoNumerico(formData, "tallaCm"),
  };

  // Plantilla por especialidad (ver changelog punto 49) — se resuelve por
  // la profesión/especialidad del médico DUEÑO de la consulta, nunca por lo
  // que venga del formulario.
  const plantilla = resolverPlantilla({
    profesion: ctx.medico.profesion,
    especialidad: ctx.medico.especialidad,
  });

  // Solo se toca camposEspecialidad si el formulario trae alguno de sus
  // campos: un envío que no los incluye no debe borrarlos.
  let camposEspecialidad: Record<string, string> | undefined;
  if (plantilla) {
    const presentes = plantilla.some((c) => formData.get(`especialidad_${c.id}`) !== null);
    if (presentes) {
      camposEspecialidad = {};
      for (const campo of plantilla) {
        const valor = leerCampo(formData, `especialidad_${campo.id}`);
        if (valor) camposEspecialidad[campo.id] = valor;
      }
    }
  }

  await guardarConsulta({
    organizacionId: ctx.organizacionId,
    actorId: ctx.actorId,
    consultaId: ctx.consultaId,
    campos,
    vitales,
    camposEspecialidad,
  });
}

export async function guardarConsultaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();
  await requirePro("consultas");

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }

  const consultaExistente = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });

  if (!consultaExistente || consultaExistente.medicoId !== medico.id) {
    redirect("/hoy");
  }

  try {
    await guardarDesdeFormulario(formData, {
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
      medico: consultaExistente.medico,
    });
  } catch {
    redirect(`/consultas/${consultaId}?error=1`);
  }

  redirect(`/consultas/${consultaId}?guardado=1`);
}

export async function cerrarConsultaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();
  await requirePro("consultas");

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }

  const consultaExistente = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });

  if (!consultaExistente || consultaExistente.medicoId !== medico.id) {
    redirect("/hoy");
  }

  // Cerrar SIEMPRE guarda antes. El botón vive en el mismo formulario que
  // las notas y manda todos los campos; si el guardado falla, no se cierra
  // — cerrar con una nota a medio guardar es irreversible.
  try {
    await guardarDesdeFormulario(formData, {
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
      medico: consultaExistente.medico,
    });
    await cerrarConsulta({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
    });
  } catch {
    redirect(`/consultas/${consultaId}?error=1`);
  }

  redirect("/hoy");
}

/**
 * Anula una consulta abierta por error (ver `anularConsulta`).
 *
 * El motivo viaja en el formulario y es obligatorio: una consulta anulada
 * sin decir por qué no le sirve a nadie que lea esa historia después. Si
 * llega vacío se vuelve a la consulta con el error, sin anular nada.
 */
export async function anularConsultaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();
  await requirePro("consultas");

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }

  // Tope en el servidor: el maxLength del formulario no protege de una
  // petición armada a mano.
  const motivo = String(formData.get("motivoAnulacion") ?? "").trim().slice(0, 300);

  const consultaExistente = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });

  if (!consultaExistente || consultaExistente.medicoId !== medico.id) {
    redirect("/hoy");
  }

  if (!motivo) {
    redirect(`/consultas/${consultaId}?error=sin_motivo`);
  }

  try {
    await anularConsulta({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      consultaId,
      motivo,
    });
  } catch (err) {
    if (err instanceof EstadoConsultaInvalidoError) {
      redirect(`/consultas/${consultaId}?error=no_anulable`);
    }
    throw err;
  }

  // A la ficha del paciente: la consulta anulada ya no es un lugar donde
  // trabajar, y lo que el médico quiere después de anular por paciente
  // equivocado es volver a buscar al correcto.
  redirect(`/pacientes/${consultaExistente.pacienteId}?anulada=1`);
}

/** Agrega una nota aclaratoria a una consulta cerrada (ver
 *  `agregarNotaAclaratoria`). */
export async function agregarNotaAclaratoriaAction(formData: FormData) {
  const { session, medico } = await requireMedicoSesion();
  await requirePro("consultas");

  const consultaId = String(formData.get("consultaId") ?? "");
  if (!consultaId) {
    throw new Error("Falta la consulta.");
  }
  const destino = `/consultas/${encodeURIComponent(consultaId)}`;

  const consultaExistente = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId,
  });
  if (!consultaExistente || consultaExistente.medicoId !== medico.id) {
    redirect("/hoy");
  }

  // Tope de tamaño en el servidor: el maxLength del formulario no protege
  // de una petición armada a mano.
  const texto = String(formData.get("textoAclaratoria") ?? "").trim().slice(0, 4000);
  if (!texto) {
    redirect(`${destino}?error=nota_vacia`);
  }

  try {
    await agregarNotaAclaratoria({
      organizacionId: session.user.organizacionId,
      actorId: session.user.id,
      medicoId: medico.id,
      consultaId,
      texto,
    });
  } catch (err) {
    if (err instanceof EstadoConsultaInvalidoError) {
      redirect(`${destino}?error=1`);
    }
    throw err;
  }

  redirect(`${destino}?nota=1`);
}

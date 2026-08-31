import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaConsulta } from "@/db/consistenciaOrganizacional";

export class ConsultaNoEncontradaError extends Error {
  constructor() {
    super("La consulta no existe o no pertenece a esta organización.");
    this.name = "ConsultaNoEncontradaError";
  }
}

export class CitaNoEncontradaError extends Error {
  constructor() {
    super("La cita no existe o no pertenece a esta organización.");
    this.name = "CitaNoEncontradaError";
  }
}

export class EstadoConsultaInvalidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "EstadoConsultaInvalidoError";
  }
}

const CAMPOS_CLINICOS = [
  "motivoConsulta",
  "anamnesis",
  "antecedentes",
  "examenFisico",
  "evaluacion",
  "diagnostico",
  "tratamiento",
] as const;

type CampoClinico = (typeof CAMPOS_CLINICOS)[number];
export type CamposClinicos = Partial<Record<CampoClinico, string | null>>;

export async function obtenerConsulta(input: {
  organizacionId: string;
  consultaId: string;
}) {
  return prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    include: {
      paciente: { select: { nombre: true, apellido: true } },
    },
  });
}

/**
 * Historia clínica longitudinal: todas las consultas de un paciente dentro
 * de la organización, más recientes primero. Nunca se filtra solo por
 * pacienteId — organizacionId siempre va en el where, para que un paciente
 * de otra organización nunca pueda resolverse aquí.
 *
 * Devuelve un resumen (fecha, estado, motivo, diagnóstico, médico), no el
 * contenido clínico completo — ese sigue viviendo únicamente en
 * obtenerConsulta/`/consultas/[id]`. El nombre del médico se expone porque
 * la relación Consulta -> Medico -> Usuario ya existe en el schema; no se
 * inventa ninguna relación nueva.
 */
export async function listarConsultasDelPaciente(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.consulta.findMany({
    where: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
    },
    select: {
      id: true,
      fechaHora: true,
      estado: true,
      motivoConsulta: true,
      diagnostico: true,
      medicoId: true,
      medico: {
        select: {
          usuario: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fechaHora: "desc" },
  });
}

/**
 * Si la Cita ya tiene una Consulta, la reutiliza (nunca duplica: Consulta.citaId
 * es @unique en el schema). Si no, valida consistencia entre organizaciones
 * antes de crear. Cuando citaId viene informado, el medicoId efectivo de la
 * Consulta es el de la propia Cita (no el del médico que hace clic), para que
 * Consulta.medicoId nunca quede inconsistente con Cita.medicoId. Para walk-in
 * (sin citaId) se usa el médico de la sesión.
 */
export async function abrirOCrearConsulta(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  pacienteId: string;
  citaId?: string | null;
}): Promise<{ consultaId: string; creada: boolean }> {
  let medicoEfectivo = input.medicoId;

  if (input.citaId) {
    const cita = await prisma.cita.findFirst({
      where: { id: input.citaId, organizacionId: input.organizacionId },
      include: { consulta: { select: { id: true } } },
    });

    if (!cita) {
      throw new CitaNoEncontradaError();
    }

    if (cita.consulta) {
      return { consultaId: cita.consulta.id, creada: false };
    }

    medicoEfectivo = cita.medicoId;
  }

  await validarConsistenciaConsulta({
    organizacionId: input.organizacionId,
    pacienteId: input.pacienteId,
    medicoId: medicoEfectivo,
    citaId: input.citaId ?? null,
  });

  const consulta = await prisma.consulta.create({
    data: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
      medicoId: medicoEfectivo,
      citaId: input.citaId ?? null,
    },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "crear_consulta",
    entidadTipo: "Consulta",
    entidadId: consulta.id,
    pacienteId: input.pacienteId,
  });

  return { consultaId: consulta.id, creada: true };
}

/**
 * Solo permitido si la consulta está EN_CURSO. No cambia el estado ni toca
 * la Cita. Registra en trazabilidad únicamente los NOMBRES de los campos que
 * realmente cambiaron (comparado contra el valor previo), nunca el contenido.
 */
export async function guardarConsulta(input: {
  organizacionId: string;
  actorId: string;
  consultaId: string;
  campos: CamposClinicos;
}): Promise<void> {
  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: {
      estado: true,
      pacienteId: true,
      motivoConsulta: true,
      anamnesis: true,
      antecedentes: true,
      examenFisico: true,
      evaluacion: true,
      diagnostico: true,
      tratamiento: true,
    },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }
  if (consulta.estado !== "EN_CURSO") {
    throw new EstadoConsultaInvalidoError(
      "Solo se puede guardar una consulta que está en curso.",
    );
  }

  const camposModificados = CAMPOS_CLINICOS.filter((campo) => {
    const nuevo = input.campos[campo];
    return nuevo !== undefined && nuevo !== consulta[campo];
  });

  if (camposModificados.length === 0) {
    return;
  }

  const data: Partial<Record<CampoClinico, string | null>> = {};
  for (const campo of camposModificados) {
    data[campo] = input.campos[campo] ?? null;
  }

  const resultado = await prisma.consulta.updateMany({
    where: {
      id: input.consultaId,
      organizacionId: input.organizacionId,
      estado: "EN_CURSO",
    },
    data,
  });

  if (resultado.count !== 1) {
    throw new EstadoConsultaInvalidoError(
      "La consulta cambió de estado antes de poder guardarse.",
    );
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "modificar_consulta",
    entidadTipo: "Consulta",
    entidadId: input.consultaId,
    pacienteId: consulta.pacienteId,
    cambios: { camposModificados },
  });
}

/**
 * Solo permitido si la consulta está EN_CURSO. Cambia Consulta -> CERRADA y,
 * si tiene citaId, Cita -> ATENDIDA, en una única transacción (si una falla,
 * ninguna queda modificada). Una consulta CERRADA o ANULADA no puede volver
 * a cerrarse.
 */
export async function cerrarConsulta(input: {
  organizacionId: string;
  actorId: string;
  consultaId: string;
}): Promise<void> {
  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: { estado: true, pacienteId: true, citaId: true },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }
  if (consulta.estado !== "EN_CURSO") {
    throw new EstadoConsultaInvalidoError(
      "Solo se puede cerrar una consulta que está en curso.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const resultadoConsulta = await tx.consulta.updateMany({
      where: {
        id: input.consultaId,
        organizacionId: input.organizacionId,
        estado: "EN_CURSO",
      },
      data: { estado: "CERRADA" },
    });

    if (resultadoConsulta.count !== 1) {
      throw new EstadoConsultaInvalidoError(
        "La consulta cambió de estado antes de poder cerrarse.",
      );
    }

    if (consulta.citaId) {
      const resultadoCita = await tx.cita.updateMany({
        where: { id: consulta.citaId, organizacionId: input.organizacionId },
        data: { estado: "ATENDIDA" },
      });

      if (resultadoCita.count !== 1) {
        throw new CitaNoEncontradaError();
      }
    }
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "cerrar_consulta",
    entidadTipo: "Consulta",
    entidadId: input.consultaId,
    pacienteId: consulta.pacienteId,
  });

  if (consulta.citaId) {
    await registrarEvento({
      organizacionId: input.organizacionId,
      actorId: input.actorId,
      accion: "marcar_atendida",
      entidadTipo: "Cita",
      entidadId: consulta.citaId,
      pacienteId: consulta.pacienteId,
    });
  }
}

import type { TipoAntecedente } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaAntecedente } from "@/db/consistenciaOrganizacional";

/**
 * Información clínica persistente del paciente (alergias, crónicas,
 * cirugías, medicación habitual, hábitos, antecedentes personales/
 * familiares, observaciones). Distinta de `Consulta.antecedentes`, que es lo
 * documentado durante un episodio puntual — ver comentario en
 * prisma/schema.prisma sobre AntecedenteMedico.
 *
 * Edición controlada: se puede crear, editar y desactivar, pero nunca
 * borrar físicamente. Editar solo está permitido mientras el registro está
 * activo — uno desactivado es historial cerrado (ver AntecedenteNoEditableError).
 * Cada creación, edición y desactivación deja trazabilidad con quién, cuándo,
 * organización, paciente y el médico/contexto bajo el que ocurrió.
 */

export class AntecedenteNoEncontradoError extends Error {
  constructor() {
    super("El antecedente no existe o no pertenece a esta organización.");
    this.name = "AntecedenteNoEncontradoError";
  }
}

export class AntecedenteNoEditableError extends Error {
  constructor() {
    super("Solo se puede editar un antecedente activo; uno desactivado es historial cerrado.");
    this.name = "AntecedenteNoEditableError";
  }
}

export async function crearAntecedente(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  pacienteId: string;
  tipo: TipoAntecedente;
  descripcion: string;
}): Promise<{ antecedenteId: string }> {
  await validarConsistenciaAntecedente({
    organizacionId: input.organizacionId,
    pacienteId: input.pacienteId,
    medicoId: input.medicoId,
  });

  const antecedente = await prisma.antecedenteMedico.create({
    data: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
      medicoId: input.medicoId,
      tipo: input.tipo,
      descripcion: input.descripcion,
    },
  });

  // No se registra `descripcion` en cambios: es contenido clínico (p.ej. el
  // detalle de una alergia), igual que el resto de la trazabilidad clínica
  // del sistema no guarda contenido, solo qué pasó y bajo qué médico.
  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "crear_antecedente",
    entidadTipo: "AntecedenteMedico",
    entidadId: antecedente.id,
    pacienteId: input.pacienteId,
    cambios: { tipo: input.tipo, medicoId: input.medicoId },
  });

  return { antecedenteId: antecedente.id };
}

/**
 * Antecedentes activos de un paciente, más recientes primero. La ficha
 * separa ALERGIA del resto para darle prioridad visual (ver
 * components/pacientes), pero la consulta trae todos juntos — agrupar es
 * responsabilidad de la UI, no del dominio.
 */
export async function listarAntecedentesDelPaciente(input: {
  organizacionId: string;
  pacienteId: string;
  incluirInactivos?: boolean;
}) {
  return prisma.antecedenteMedico.findMany({
    where: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
      ...(input.incluirInactivos ? {} : { activo: true }),
    },
    include: {
      medico: { select: { usuario: { select: { nombre: true } } } },
    },
    orderBy: { fecha: "desc" },
  });
}

/**
 * Edita tipo/descripción de un antecedente ACTIVO (ver AntecedenteNoEditableError
 * si ya está desactivado). No cambia `medicoId` del registro original —
 * ese campo sigue identificando quién lo registró originalmente; el médico
 * que edita queda en la trazabilidad del evento, no reemplaza la autoría.
 */
export async function editarAntecedente(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  antecedenteId: string;
  tipo: TipoAntecedente;
  descripcion: string;
}): Promise<void> {
  const antecedente = await prisma.antecedenteMedico.findFirst({
    where: { id: input.antecedenteId, organizacionId: input.organizacionId },
  });

  if (!antecedente) {
    throw new AntecedenteNoEncontradoError();
  }

  if (!antecedente.activo) {
    throw new AntecedenteNoEditableError();
  }

  const camposModificados: string[] = [];
  if (antecedente.tipo !== input.tipo) camposModificados.push("tipo");
  if (antecedente.descripcion !== input.descripcion) camposModificados.push("descripcion");

  if (camposModificados.length === 0) {
    return;
  }

  await prisma.antecedenteMedico.update({
    where: { id: input.antecedenteId },
    data: { tipo: input.tipo, descripcion: input.descripcion },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "editar_antecedente",
    entidadTipo: "AntecedenteMedico",
    entidadId: input.antecedenteId,
    pacienteId: antecedente.pacienteId,
    cambios: { camposModificados, medicoId: input.medicoId },
  });
}

/**
 * Desactiva un antecedente (corrección lógica, no borrado). Cualquier
 * médico de la organización puede hacerlo, mismo criterio de acceso
 * organizacional que ya rige lectura/escritura de Consulta.
 */
export async function desactivarAntecedente(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  antecedenteId: string;
}): Promise<void> {
  const antecedente = await prisma.antecedenteMedico.findFirst({
    where: { id: input.antecedenteId, organizacionId: input.organizacionId },
    select: { pacienteId: true, activo: true },
  });

  if (!antecedente) {
    throw new AntecedenteNoEncontradoError();
  }

  if (!antecedente.activo) {
    return;
  }

  await prisma.antecedenteMedico.update({
    where: { id: input.antecedenteId },
    data: { activo: false },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "desactivar_antecedente",
    entidadTipo: "AntecedenteMedico",
    entidadId: input.antecedenteId,
    pacienteId: antecedente.pacienteId,
    cambios: { medicoId: input.medicoId },
  });
}

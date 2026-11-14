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
 * Edición controlada: se puede crear, corregir, desactivar y reactivar,
 * pero nunca borrar físicamente ni pisar texto. Corregir crea una versión
 * nueva y deja la anterior inactiva apuntando a ella (`reemplazadoPorId`);
 * desactivar se puede deshacer con reactivar. Editar solo está permitido
 * mientras el registro está activo (ver AntecedenteNoEditableError).
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

  // 13-nov-2026 (segunda revisión del núcleo clínico): antes esto hacía un
  // update en sitio. "Alergia a penicilina" corregida a "Alergia a sulfas"
  // borraba lo que decía antes, y la auditoría solo guarda qué campos
  // cambiaron, no su contenido — así que el texto anterior se perdía para
  // siempre. Ahora la corrección es una fila nueva; la vieja queda
  // inactiva, intacta, apuntando a la que la reemplazó.
  //
  // La nueva conserva `fecha` (cuándo se registró el antecedente, que es
  // el dato clínico) y `medicoId` del original.
  await prisma.$transaction(async (tx) => {
    const nueva = await tx.antecedenteMedico.create({
      data: {
        organizacionId: input.organizacionId,
        pacienteId: antecedente.pacienteId,
        medicoId: antecedente.medicoId,
        tipo: input.tipo,
        descripcion: input.descripcion,
        fecha: antecedente.fecha,
      },
    });
    // `activo: true` en el where: si otra pestaña ya lo corrigió o lo
    // desactivó, actualiza 0 filas y no quedan dos versiones vivas.
    const vieja = await tx.antecedenteMedico.updateMany({
      where: { id: input.antecedenteId, organizacionId: input.organizacionId, activo: true },
      data: { activo: false, reemplazadoPorId: nueva.id },
    });
    if (vieja.count !== 1) {
      throw new AntecedenteNoEditableError();
    }
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

/**
 * Antecedentes inactivos de un paciente: los desactivados a mano y las
 * versiones anteriores de los corregidos. Antes ninguna pantalla los
 * mostraba, así que desactivar una alergia por error la hacía desaparecer
 * sin dejar señal.
 */
export async function listarAntecedentesInactivos(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.antecedenteMedico.findMany({
    where: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
      activo: false,
    },
    select: {
      id: true,
      tipo: true,
      descripcion: true,
      fecha: true,
      updatedAt: true,
      reemplazadoPorId: true,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Deshace una desactivación. Desactivar es un clic, y sobre una alergia
 * ese clic equivocado es un riesgo para el paciente: tiene que tener
 * vuelta atrás. Una versión reemplazada por una corrección NO se reactiva
 * (dejaría dos versiones vivas del mismo antecedente).
 */
export async function reactivarAntecedente(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  antecedenteId: string;
}): Promise<void> {
  const antecedente = await prisma.antecedenteMedico.findFirst({
    where: { id: input.antecedenteId, organizacionId: input.organizacionId },
    select: { pacienteId: true, activo: true, reemplazadoPorId: true },
  });

  if (!antecedente) {
    throw new AntecedenteNoEncontradoError();
  }
  if (antecedente.activo) {
    return;
  }
  if (antecedente.reemplazadoPorId) {
    throw new AntecedenteNoEditableError();
  }

  await prisma.antecedenteMedico.updateMany({
    where: {
      id: input.antecedenteId,
      organizacionId: input.organizacionId,
      activo: false,
      reemplazadoPorId: null,
    },
    data: { activo: true },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "reactivar_antecedente",
    entidadTipo: "AntecedenteMedico",
    entidadId: input.antecedenteId,
    pacienteId: antecedente.pacienteId,
    cambios: { medicoId: input.medicoId },
  });
}

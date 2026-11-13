import { prisma } from "@/db/client";
import type { Prisma, TipoDocumento } from "@prisma/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaDocumento } from "@/db/consistenciaOrganizacional";
import {
  ConsultaNoEncontradaError,
  EstadoConsultaInvalidoError,
} from "@/modules/core/consultas";

/**
 * Casos de uso reales de Documento (Bloque E — MVP de recetas). Un documento
 * es inmutable: no existe actualizar/editar aquí, solo emitir, listar,
 * obtener y ANULAR — que no es editar ni borrar: el documento se queda
 * entero, marcado, con fecha y motivo. Toda lectura/escritura va scoped por organizacionId; el médico
 * emisor y el actor de trazabilidad siempre vienen de la sesión — nunca del
 * cliente (ver las Server Actions en
 * app/(dashboard)/consultas/[id]/documentos).
 */

export interface MedicamentoRecetado {
  nombre: string;
  indicaciones: string;
}

/** Forma de `contenido` cuando tipo = RECETA. */
export interface ContenidoReceta {
  medicamentos: MedicamentoRecetado[];
  indicacionesGenerales: string | null;
}

/**
 * Un documento solo puede emitirse sobre una consulta activa (EN_CURSO o
 * CERRADA) — nunca sobre una ANULADA. A diferencia de guardar/cerrar
 * consulta, aquí sí se permite EN_CURSO además de CERRADA: una receta puede
 * necesitarse durante la atención, no solo al cierre.
 */
export async function emitirDocumento(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  consultaId: string;
  tipo: TipoDocumento;
  contenido: ContenidoReceta;
}): Promise<{ documentoId: string }> {
  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: { pacienteId: true, estado: true },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }

  if (consulta.estado === "ANULADA") {
    throw new EstadoConsultaInvalidoError(
      "No se puede emitir un documento sobre una consulta anulada.",
    );
  }

  await validarConsistenciaDocumento({
    organizacionId: input.organizacionId,
    consultaId: input.consultaId,
    medicoId: input.medicoId,
  });

  const documento = await prisma.documento.create({
    data: {
      organizacionId: input.organizacionId,
      consultaId: input.consultaId,
      medicoId: input.medicoId,
      tipo: input.tipo,
      contenido: input.contenido as unknown as Prisma.InputJsonValue,
    },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "emitir_documento",
    entidadTipo: "Documento",
    entidadId: documento.id,
    pacienteId: consulta.pacienteId,
    cambios: { tipo: input.tipo },
  });

  return { documentoId: documento.id };
}

export class DocumentoNoEncontradoError extends Error {
  constructor() {
    super("El documento no existe o no pertenece a esta organización.");
    this.name = "DocumentoNoEncontradoError";
  }
}

export class DocumentoYaAnuladoError extends Error {
  constructor() {
    super("Este documento ya está anulado.");
    this.name = "DocumentoYaAnuladoError";
  }
}

/**
 * Anula una receta equivocada (13-nov-2026, auditoría del núcleo clínico).
 *
 * EL HUECO QUE CIERRA: no había forma de invalidar una receta mal emitida
 * —medicamento equivocado, dosis equivocada—. Seguía imprimible y con cara
 * de válida, y si el médico emitía la correcta, la historia quedaba con
 * dos recetas contradictorias sin ninguna señal de cuál vale.
 *
 * NO SE BORRA, SE MARCA. Una receta que desaparece deja la historia
 * clínica mintiendo; una marcada como anulada la deja diciendo la verdad,
 * que es justo lo que hace falta si alguien pregunta después qué se le
 * recetó a este paciente y cuándo.
 *
 * El motivo es obligatorio por lo mismo: "anulada" sin decir por qué no le
 * sirve a nadie que lea esa historia después.
 */
export async function anularDocumento(input: {
  organizacionId: string;
  actorId: string;
  documentoId: string;
  motivo: string;
}): Promise<void> {
  const motivo = input.motivo.trim();
  if (!motivo) {
    throw new DocumentoNoEncontradoError();
  }

  const documento = await prisma.documento.findFirst({
    where: { id: input.documentoId, organizacionId: input.organizacionId },
    select: { anuladoEn: true, consulta: { select: { pacienteId: true } } },
  });

  if (!documento) {
    throw new DocumentoNoEncontradoError();
  }
  if (documento.anuladoEn) {
    throw new DocumentoYaAnuladoError();
  }

  // updateMany con `anuladoEn: null` en el where: si otra pestaña lo anuló
  // entre la lectura y esta escritura, actualiza 0 filas y no se pisa el
  // motivo que puso la primera.
  const resultado = await prisma.documento.updateMany({
    where: { id: input.documentoId, organizacionId: input.organizacionId, anuladoEn: null },
    data: { anuladoEn: new Date(), motivoAnulacion: motivo },
  });

  if (resultado.count !== 1) {
    throw new DocumentoYaAnuladoError();
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "anular_documento",
    entidadTipo: "Documento",
    entidadId: input.documentoId,
    pacienteId: documento.consulta.pacienteId,
    cambios: { motivo },
  });
}

/** Resumen de los documentos de una consulta — para la sección Documentos de /consultas/[id]. */
export async function listarDocumentosDeConsulta(input: {
  organizacionId: string;
  consultaId: string;
}) {
  return prisma.documento.findMany({
    where: {
      organizacionId: input.organizacionId,
      consultaId: input.consultaId,
    },
    select: {
      id: true,
      tipo: true,
      fechaEmision: true,
      anuladoEn: true,
      motivoAnulacion: true,
      medico: {
        select: { usuario: { select: { nombre: true } } },
      },
    },
    orderBy: { fechaEmision: "desc" },
  });
}

/**
 * Documentos de TODAS las consultas de un paciente, más recientes primero —
 * para la sección "Documentos" de la ficha del paciente. `documento` no
 * tiene `pacienteId` propio (se deriva de `consulta.pacienteId`, ver
 * comentario del modelo en schema.prisma), así que se filtra por relación
 * anidada en vez de por un campo directo.
 */
export async function listarDocumentosDelPaciente(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.documento.findMany({
    where: {
      organizacionId: input.organizacionId,
      consulta: { pacienteId: input.pacienteId },
    },
    select: {
      id: true,
      tipo: true,
      fechaEmision: true,
      anuladoEn: true,
      motivoAnulacion: true,
      consultaId: true,
      medico: {
        select: { usuario: { select: { nombre: true } } },
      },
    },
    orderBy: { fechaEmision: "desc" },
  });
}

/** Documento completo, con lo necesario para la vista de detalle/impresión. */
export async function obtenerDocumento(input: {
  organizacionId: string;
  documentoId: string;
}) {
  return prisma.documento.findFirst({
    where: { id: input.documentoId, organizacionId: input.organizacionId },
    include: {
      consulta: {
        select: {
          paciente: { select: { nombre: true, apellido: true } },
        },
      },
      medico: {
        select: {
          especialidad: true,
          numeroColegiado: true,
          usuario: { select: { nombre: true } },
        },
      },
      organizacion: { select: { nombre: true } },
    },
  });
}

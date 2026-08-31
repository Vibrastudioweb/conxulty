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
 * es inmutable: no existe actualizar/editar aquí, solo emitir, listar y
 * obtener. Toda lectura/escritura va scoped por organizacionId; el médico
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

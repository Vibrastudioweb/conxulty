import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";

/**
 * Casos de uso de Paciente. Toda lectura por ID usa findFirst con
 * organizacionId en el where — findUnique no permite combinar id +
 * organizacionId sin una unique compuesta, así que no se usa aquí a
 * propósito.
 */

export const PACIENTES_POR_PAGINA = 20;

export interface DatosPaciente {
  nombre: string;
  apellido: string;
  fechaNacimiento?: Date | null;
  sexo?: string | null;
  telefono?: string | null;
  email?: string | null;
  documentoIdentidad?: string | null;
  direccion?: string | null;
  contactoEmergenciaNombre?: string | null;
  contactoEmergenciaTelefono?: string | null;
}

const CAMPOS_PACIENTE = [
  "nombre",
  "apellido",
  "fechaNacimiento",
  "sexo",
  "telefono",
  "email",
  "documentoIdentidad",
  "direccion",
  "contactoEmergenciaNombre",
  "contactoEmergenciaTelefono",
] as const;

export class PacienteNoEncontradoError extends Error {
  constructor() {
    super("El paciente no existe o no pertenece a esta organización.");
    this.name = "PacienteNoEncontradoError";
  }
}

export class DocumentoIdentidadDuplicadoError extends Error {
  constructor() {
    super("Ya existe un paciente con ese documento de identidad en esta organización.");
    this.name = "DocumentoIdentidadDuplicadoError";
  }
}

/** Un paciente archivado puede seguir consultándose (ficha, historial,
 *  documentos) pero no puede recibir citas nuevas ni iniciar consultas
 *  nuevas — ver crearCita (modules/core/citas.ts) y abrirOCrearConsulta
 *  (modules/core/consultas.ts), que lanzan este error en dominio, no solo
 *  ocultan el botón en la ficha. */
export class PacienteArchivadoError extends Error {
  constructor() {
    super("El paciente está archivado: reactívalo antes de crear citas o consultas nuevas.");
    this.name = "PacienteArchivadoError";
  }
}

export async function obtenerPaciente(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.paciente.findFirst({
    where: { id: input.pacienteId, organizacionId: input.organizacionId },
  });
}

/**
 * Trae una página de `porPagina + 1` resultados y descarta el sobrante:
 * evita una consulta COUNT aparte solo para saber si "hay siguiente",
 * suficiente para una paginación Anterior/Siguiente (mismo criterio que no
 * sobre-construir que ya sigue el resto del código).
 */
function dividirPagina<T>(filas: T[], porPagina: number) {
  const haySiguiente = filas.length > porPagina;
  return { items: filas.slice(0, porPagina), haySiguiente };
}

export async function listarPacientes(input: {
  organizacionId: string;
  pagina?: number;
  incluirInactivos?: boolean;
}) {
  const pagina = input.pagina && input.pagina > 0 ? input.pagina : 1;

  const filas = await prisma.paciente.findMany({
    where: {
      organizacionId: input.organizacionId,
      ...(input.incluirInactivos ? {} : { activo: true }),
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    skip: (pagina - 1) * PACIENTES_POR_PAGINA,
    take: PACIENTES_POR_PAGINA + 1,
  });

  return dividirPagina(filas, PACIENTES_POR_PAGINA);
}

export async function buscarPacientes(input: {
  organizacionId: string;
  texto: string;
  pagina?: number;
  incluirInactivos?: boolean;
}) {
  const texto = input.texto.trim();
  if (!texto) return { items: [], haySiguiente: false };

  const pagina = input.pagina && input.pagina > 0 ? input.pagina : 1;

  const filas = await prisma.paciente.findMany({
    where: {
      organizacionId: input.organizacionId,
      ...(input.incluirInactivos ? {} : { activo: true }),
      OR: [
        { nombre: { contains: texto, mode: "insensitive" } },
        { apellido: { contains: texto, mode: "insensitive" } },
        { documentoIdentidad: { contains: texto, mode: "insensitive" } },
      ],
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
    skip: (pagina - 1) * PACIENTES_POR_PAGINA,
    take: PACIENTES_POR_PAGINA + 1,
  });

  return dividirPagina(filas, PACIENTES_POR_PAGINA);
}

function normalizarDatos(datos: DatosPaciente) {
  return {
    nombre: datos.nombre,
    apellido: datos.apellido,
    fechaNacimiento: datos.fechaNacimiento ?? null,
    sexo: datos.sexo ?? null,
    telefono: datos.telefono ?? null,
    email: datos.email ?? null,
    documentoIdentidad: datos.documentoIdentidad ?? null,
    direccion: datos.direccion ?? null,
    contactoEmergenciaNombre: datos.contactoEmergenciaNombre ?? null,
    contactoEmergenciaTelefono: datos.contactoEmergenciaTelefono ?? null,
  };
}

/** Respaldo ante condición de carrera: si dos escrituras concurrentes pasan
 *  ambas el pre-check de `documentoIdentidadEnUso`, la constraint única de
 *  base de datos (`@@unique([organizacionId, documentoIdentidad])`) es la
 *  que realmente lo impide — esto solo traduce ese fallo (P2002) al error
 *  de negocio en vez de dejarlo salir como un 500 genérico. */
function esErrorDocumentoDuplicado(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002" &&
    (err.meta?.target as string[] | undefined)?.includes("documentoIdentidad") === true
  );
}

/** `true` si ya existe otro paciente de la misma organización con ese
 *  documento — usado para devolver un error de negocio claro en vez de
 *  dejar que la constraint de base de datos lo reviente como 500. */
async function documentoIdentidadEnUso(input: {
  organizacionId: string;
  documentoIdentidad: string;
  excluirPacienteId?: string;
}): Promise<boolean> {
  const existente = await prisma.paciente.findFirst({
    where: {
      organizacionId: input.organizacionId,
      documentoIdentidad: input.documentoIdentidad,
      ...(input.excluirPacienteId ? { id: { not: input.excluirPacienteId } } : {}),
    },
    select: { id: true },
  });
  return existente !== null;
}

export async function crearPaciente(input: {
  organizacionId: string;
  actorId: string;
  datos: DatosPaciente;
}) {
  if (input.datos.documentoIdentidad) {
    const enUso = await documentoIdentidadEnUso({
      organizacionId: input.organizacionId,
      documentoIdentidad: input.datos.documentoIdentidad,
    });
    if (enUso) {
      throw new DocumentoIdentidadDuplicadoError();
    }
  }

  let paciente;
  try {
    paciente = await prisma.paciente.create({
      data: {
        organizacionId: input.organizacionId,
        ...normalizarDatos(input.datos),
      },
    });
  } catch (err) {
    if (esErrorDocumentoDuplicado(err)) {
      throw new DocumentoIdentidadDuplicadoError();
    }
    throw err;
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "crear_paciente",
    entidadTipo: "Paciente",
    entidadId: paciente.id,
    pacienteId: paciente.id,
  });

  return paciente;
}

/**
 * Trazabilidad: solo se registran los NOMBRES de los campos modificados,
 * nunca el valor (mismo criterio que guardarConsulta/actualizarCita) — ni
 * siquiera el teléfono o la dirección son necesarios en el log de cambios,
 * solo que cambiaron.
 */
export async function actualizarPaciente(input: {
  organizacionId: string;
  actorId: string;
  pacienteId: string;
  datos: DatosPaciente;
}): Promise<void> {
  const paciente = await prisma.paciente.findFirst({
    where: { id: input.pacienteId, organizacionId: input.organizacionId },
  });

  if (!paciente) {
    throw new PacienteNoEncontradoError();
  }

  if (
    input.datos.documentoIdentidad &&
    input.datos.documentoIdentidad !== paciente.documentoIdentidad
  ) {
    const enUso = await documentoIdentidadEnUso({
      organizacionId: input.organizacionId,
      documentoIdentidad: input.datos.documentoIdentidad,
      excluirPacienteId: input.pacienteId,
    });
    if (enUso) {
      throw new DocumentoIdentidadDuplicadoError();
    }
  }

  const datosNuevos = normalizarDatos(input.datos);
  const camposModificados = CAMPOS_PACIENTE.filter((campo) => {
    const anterior = paciente[campo];
    const nuevo = datosNuevos[campo];
    if (anterior instanceof Date || nuevo instanceof Date) {
      return (anterior as Date | null)?.getTime() !== (nuevo as Date | null)?.getTime();
    }
    return anterior !== nuevo;
  });

  if (camposModificados.length === 0) {
    return;
  }

  try {
    await prisma.paciente.update({
      where: { id: input.pacienteId },
      data: datosNuevos,
    });
  } catch (err) {
    if (esErrorDocumentoDuplicado(err)) {
      throw new DocumentoIdentidadDuplicadoError();
    }
    throw err;
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "editar_paciente",
    entidadTipo: "Paciente",
    entidadId: input.pacienteId,
    pacienteId: input.pacienteId,
    cambios: { camposModificados },
  });
}

async function cambiarActivoPaciente(input: {
  organizacionId: string;
  actorId: string;
  pacienteId: string;
  activo: boolean;
}): Promise<void> {
  const paciente = await prisma.paciente.findFirst({
    where: { id: input.pacienteId, organizacionId: input.organizacionId },
    select: { activo: true },
  });

  if (!paciente) {
    throw new PacienteNoEncontradoError();
  }

  if (paciente.activo === input.activo) {
    return;
  }

  await prisma.paciente.update({
    where: { id: input.pacienteId },
    data: { activo: input.activo },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: input.activo ? "reactivar_paciente" : "archivar_paciente",
    entidadTipo: "Paciente",
    entidadId: input.pacienteId,
    pacienteId: input.pacienteId,
  });
}

export async function archivarPaciente(input: {
  organizacionId: string;
  actorId: string;
  pacienteId: string;
}): Promise<void> {
  await cambiarActivoPaciente({ ...input, activo: false });
}

export async function reactivarPaciente(input: {
  organizacionId: string;
  actorId: string;
  pacienteId: string;
}): Promise<void> {
  await cambiarActivoPaciente({ ...input, activo: true });
}

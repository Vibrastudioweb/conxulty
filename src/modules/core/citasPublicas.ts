import crypto from "node:crypto";
import type { ModalidadAtencion, ModalidadCita } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { crearPaciente } from "@/modules/core/pacientes";
import {
  hayConflictoHorario,
  listarIntervalosOcupados,
  DURACION_MINUTOS_DEFECTO,
  CitaConflictoHorarioError,
} from "@/modules/core/citas";

/**
 * 10-nov-2026, pedido del usuario ("las modalidades que se activan en la
 * ficha del médico son las que el médico active como disponibles con las
 * que él trabaja"): hasta ahora `crearCitaPublicaPorFicha` fijaba
 * `modalidad: "PRESENCIAL"` para TODA reserva del Directorio, sin
 * importar si el paciente eligió "A domicilio" u "Online" en
 * AgendaCita.svelte (ese valor se mandaba como `motivo`, nunca como la
 * modalidad real de la Cita — ver comentario en ese componente, vitalud).
 * Ahora la modalidad elegida viaja de verdad, mapeada al enum de Cita
 * (`ModalidadCita` usa VIDEOCONSULTA donde el catálogo de atención del
 * médico usa ONLINE — mismo concepto, nombre distinto en cada esquema) y
 * SIEMPRE validada contra `Medico.modalidades` acá en el servidor: el
 * Directorio ya solo muestra como chip las modalidades que el médico
 * activó (ver `modalidadesDisponibles` en +page.svelte), pero nunca hay
 * que confiar en lo que mande el cliente sin repetir ese chequeo del lado
 * de adentro.
 */
const MODALIDAD_MEDICO_A_CITA: Record<ModalidadAtencion, ModalidadCita> = {
  PRESENCIAL: "PRESENCIAL",
  DOMICILIO: "DOMICILIO",
  ONLINE: "VIDEOCONSULTA",
};
const MODALIDAD_PUBLICA_A_MEDICO: Record<string, ModalidadAtencion> = {
  presencial: "PRESENCIAL",
  domicilio: "DOMICILIO",
  online: "ONLINE",
};

function resolverModalidadCita(
  valorPublico: string | null | undefined,
  modalidadesMedico: ModalidadAtencion[],
): ModalidadCita {
  const pedida = valorPublico ? MODALIDAD_PUBLICA_A_MEDICO[valorPublico.trim().toLowerCase()] : undefined;
  const modalidadValida =
    pedida && modalidadesMedico.includes(pedida)
      ? pedida
      : // Lo que mandaron no vino, no se reconoce, o el médico no lo tiene
        // activo (desincronizado con lo que vio en la ficha, o manipulado)
        // — se cae a la primera modalidad que el médico sí ofrece, nunca a
        // PRESENCIAL a ciegas si ni siquiera la tiene marcada.
        modalidadesMedico[0];
  return MODALIDAD_MEDICO_A_CITA[modalidadValida ?? "PRESENCIAL"];
}

/**
 * Reserva pública de citas (Task #15, changelog punto 91/97) — la ÚNICA
 * puerta de entrada para que una Cita nazca desde FUERA del OS (la ficha
 * pública en conxulty.com, repo `vitalud`). Llamada por
 * /api/directorio/reservar-cita, nunca directo desde un Server Action de
 * sesión — por eso vive en su propio módulo en vez de agregarse a
 * citas.ts: toda función de citas.ts asume una sesión real
 * (requireMedicoSesion) y un actorId confiable; acá no hay sesión, así
 * que cada decisión de confianza se documenta explícitamente.
 *
 * Reutiliza `crearPaciente` y `hayConflictoHorario` de los módulos
 * existentes en vez de reimplementar su lógica — la única pieza nueva de
 * verdad es resolver `fichaDirectorioId` -> organización/médico y la
 * generación del token de reseña.
 */

export class FichaNoEncontradaError extends Error {
  constructor() {
    super("No existe ninguna ficha con ese id, o no está sincronizada con un médico.");
    this.name = "FichaNoEncontradaError";
  }
}

export class FichaSinMedicoError extends Error {
  constructor() {
    super("Esta ficha no tiene un médico asociado en el OS.");
    this.name = "FichaSinMedicoError";
  }
}

/**
 * Médico dueño de una ficha pública, resuelto por `fichaDirectorioId`
 * (el mismo uuid en ambos lados — ver sincronizacion.ts). Una
 * Organizacion tiene `medicos: Medico[]` en el esquema (deja espacio
 * para consultorios con varios médicos a futuro), pero HOY todo el flujo
 * de registro/"Mi ficha pública" asume uno solo por Organizacion de tipo
 * médico — se toma el primero. HIPÓTESIS a confirmar si alguna vez se
 * construye un onboarding multi-médico: hoy no hay forma de que haya
 * más de uno en la práctica.
 */
async function resolverMedicoPorFicha(fichaDirectorioId: string) {
  const organizacion = await prisma.organizacion.findUnique({
    where: { fichaDirectorioId },
    select: {
      id: true,
      medicos: {
        select: { id: true, usuarioId: true, modalidades: true },
        take: 1,
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!organizacion) throw new FichaNoEncontradaError();
  const medico = organizacion.medicos[0];
  if (!medico) throw new FichaSinMedicoError();
  return {
    organizacionId: organizacion.id,
    medicoId: medico.id,
    actorId: medico.usuarioId,
    modalidades: medico.modalidades,
  };
}

/** Máximo de citas del Directorio todavía sin confirmar que una misma
 *  persona (mismo teléfono) puede tener a futuro con un médico (auditoría
 *  12-nov-2026, hallazgo A1). */
const MAXIMO_PENDIENTES_POR_TELEFONO = 3;

export class DemasiadasCitasPendientesError extends Error {
  constructor() {
    super(
      "Ya tienes varias citas pendientes de confirmar con este profesional. Espera su confirmación o escríbele por WhatsApp.",
    );
    this.name = "DemasiadasCitasPendientesError";
  }
}

/**
 * Últimos 10 dígitos de un teléfono: la parte que identifica la línea sin
 * importar cómo se escribió ("0414-123 4567", "+58 414 1234567" y
 * "4141234567" dan lo mismo). Devuelve null si no llega a 10 dígitos.
 */
export function clavePorTelefono(telefono: string | null | undefined): string | null {
  const digitos = (telefono ?? "").replace(/\D/g, "");
  return digitos.length >= 10 ? digitos.slice(-10) : null;
}

/**
 * Busca un Paciente activo de la organización por teléfono (sin
 * documentoIdentidad, que el formulario público no pide) para no crear
 * un registro nuevo cada vez que la misma persona reserva de nuevo.
 *
 * 12-nov-2026 (auditoría, M2): antes se buscaba con `contains` sobre los
 * dígitos recibidos. Eso fallaba en los dos sentidos: un número corto
 * ("12345") enganchaba la cita al primer paciente cuyo teléfono lo
 * contuviera, y un paciente guardado como "0414-123 4567" nunca coincidía
 * con "04141234567" y se duplicaba. Ahora se comparan los últimos 10
 * dígitos de ambos lados. Se hace en memoria porque el teléfono se guarda
 * tal como se escribió; son los pacientes de un solo consultorio.
 */
async function buscarPacientePorTelefono(input: {
  organizacionId: string;
  telefono: string;
}): Promise<string | null> {
  const clave = clavePorTelefono(input.telefono);
  if (!clave) return null;
  const candidatos = await prisma.paciente.findMany({
    where: { organizacionId: input.organizacionId, activo: true, telefono: { not: null } },
    select: { id: true, telefono: true },
    orderBy: { createdAt: "asc" },
  });
  return candidatos.find((p) => clavePorTelefono(p.telefono) === clave)?.id ?? null;
}

async function buscarOCrearPacientePorTelefono(input: {
  organizacionId: string;
  actorId: string;
  nombreCompleto: string;
  telefono: string;
}) {
  const existente = await buscarPacientePorTelefono(input);
  if (existente) return existente;

  // El formulario público pide un solo campo de nombre — se divide en
  // nombre/apellido lo mejor posible; si no hay espacio, todo va a
  // `nombre` y `apellido` queda con un placeholder explícito (nunca
  // vacío: el campo es requerido en el esquema).
  const partes = input.nombreCompleto.trim().split(/\s+/);
  const nombre = partes[0] ?? input.nombreCompleto.trim();
  const apellido = partes.slice(1).join(" ") || "(sin apellido)";

  const paciente = await crearPaciente({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    datos: { nombre, apellido, telefono: input.telefono.trim() },
  });
  return paciente.id;
}

/** Hasta cuántos días adelante informa disponibilidad la ficha pública
 *  (la ficha muestra 30; se deja margen). */
const DIAS_DISPONIBILIDAD = 45;

/**
 * Lo que la ficha pública necesita saber ANTES de ofrecer el formulario de
 * reserva (12-nov-2026, auditoría del flujo Directorio → cita → OS):
 *
 * - `conectada`: si detrás de esa ficha hay un médico en el OS. Sin esto
 *   el formulario aparecía en cualquier ficha con horario y, en las que no
 *   tenían cuenta, fallaba recién al final con un mensaje técnico.
 * - `ocupados`: los intervalos ya tomados, para no ofrecer un horario que
 *   la reserva va a rechazar.
 *
 * Nunca lanza por "ficha sin médico": eso es una respuesta válida
 * (`conectada: false`), no un error.
 */
export async function disponibilidadPorFicha(fichaDirectorioId: string): Promise<{
  conectada: boolean;
  duracionMinutos: number;
  ocupados: { inicio: string; fin: string }[];
}> {
  const organizacion = await prisma.organizacion.findUnique({
    where: { fichaDirectorioId },
    select: { id: true, medicos: { select: { id: true }, take: 1, orderBy: { createdAt: "asc" } } },
  });
  const medico = organizacion?.medicos[0];
  if (!organizacion || !medico) {
    return { conectada: false, duracionMinutos: DURACION_MINUTOS_DEFECTO, ocupados: [] };
  }
  const desde = new Date();
  const hasta = new Date(desde.getTime() + DIAS_DISPONIBILIDAD * 24 * 60 * 60 * 1000);
  const ocupados = await listarIntervalosOcupados({
    organizacionId: organizacion.id,
    medicoId: medico.id,
    desde,
    hasta,
  });
  return {
    conectada: true,
    duracionMinutos: DURACION_MINUTOS_DEFECTO,
    ocupados: ocupados.map((i) => ({ inicio: i.inicio.toISOString(), fin: i.fin.toISOString() })),
  };
}

export async function crearCitaPublicaPorFicha(input: {
  fichaDirectorioId: string;
  nombrePaciente: string;
  telefonoPaciente: string;
  fechaHora: Date;
  motivo?: string | null;
  /** 'presencial' | 'domicilio' | 'online' — el `valor` que ya manda
   *  AgendaCita.svelte (vitalud) para el chip de modalidad elegido, nunca
   *  el enum de Prisma directo (ese vocabulario es interno del OS). */
  modalidad?: string | null;
}): Promise<{ citaId: string; tokenResena: string }> {
  const { organizacionId, medicoId, actorId, modalidades } = await resolverMedicoPorFicha(
    input.fichaDirectorioId,
  );

  const conflicto = await hayConflictoHorario({
    organizacionId,
    medicoId,
    fechaHora: input.fechaHora,
    duracionMinutos: DURACION_MINUTOS_DEFECTO,
  });
  if (conflicto) throw new CitaConflictoHorarioError();

  // Tope por persona ANTES de crear nada: quien ya tiene 3 citas del
  // Directorio sin confirmar con este médico no puede seguir apartando
  // horarios (cada PENDIENTE bloquea su hueco en la agenda).
  const pacienteExistente = await buscarPacientePorTelefono({
    organizacionId,
    telefono: input.telefonoPaciente,
  });
  if (pacienteExistente) {
    const pendientes = await prisma.cita.count({
      where: {
        organizacionId,
        medicoId,
        pacienteId: pacienteExistente,
        origen: "DIRECTORIO",
        estado: "PENDIENTE",
        fechaHora: { gte: new Date() },
      },
    });
    if (pendientes >= MAXIMO_PENDIENTES_POR_TELEFONO) throw new DemasiadasCitasPendientesError();
  }

  const pacienteId = await buscarOCrearPacientePorTelefono({
    organizacionId,
    actorId,
    nombreCompleto: input.nombrePaciente,
    telefono: input.telefonoPaciente,
  });

  const tokenResena = crypto.randomUUID();
  const modalidad = resolverModalidadCita(input.modalidad, modalidades);

  const cita = await prisma.cita.create({
    data: {
      organizacionId,
      pacienteId,
      medicoId,
      fechaHora: input.fechaHora,
      duracionMinutos: DURACION_MINUTOS_DEFECTO,
      modalidad,
      estado: "PENDIENTE",
      origen: "DIRECTORIO",
      motivo: input.motivo?.trim() || null,
      notas: "Reservada desde la ficha pública (conxulty.com) — pendiente de confirmar.",
      tokenResena,
    },
    select: { id: true },
  });

  await registrarEvento({
    organizacionId,
    actorId,
    accion: "crear_cita_publica",
    entidadTipo: "Cita",
    entidadId: cita.id,
    pacienteId,
  });

  return { citaId: cita.id, tokenResena };
}

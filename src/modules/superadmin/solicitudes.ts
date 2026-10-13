import bcrypt from "bcryptjs";
import type { RolUsuario } from "@prisma/client";
import { prisma } from "@/db/client";
import { generarPasswordTemporal } from "./password";

/**
 * Operaciones del panel de súper-admin sobre solicitudes de acceso.
 * Ninguna función de aquí verifica el rol: lo hace SIEMPRE el llamador
 * (page/action) con requireSuperadmin() — ver modules/core/autorizacion.ts.
 */

export class SolicitudNoEncontradaError extends Error {
  constructor() {
    super("La solicitud no existe.");
    this.name = "SolicitudNoEncontradaError";
  }
}
export class SolicitudYaResueltaError extends Error {
  constructor() {
    super("La solicitud ya fue activada o rechazada.");
    this.name = "SolicitudYaResueltaError";
  }
}
export class EmailEnUsoError extends Error {
  constructor() {
    super("Ya existe un usuario con ese correo.");
    this.name = "EmailEnUsoError";
  }
}
export class OrganizacionNoEncontradaError extends Error {
  constructor() {
    super("La organización elegida no existe.");
    this.name = "OrganizacionNoEncontradaError";
  }
}

/** PENDIENTE primero (orden de declaración del enum), luego más recientes. */
export async function listarSolicitudes() {
  return prisma.solicitudAcceso.findMany({
    orderBy: [{ estado: "asc" }, { createdAt: "desc" }],
  });
}

export async function listarOrganizaciones() {
  return prisma.organizacion.findMany({
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true },
  });
}

export interface ActivacionInput {
  solicitudId: string;
  /** Organización existente; si es null se crea una nueva con nombreOrganizacion. */
  organizacionId: string | null;
  nombreOrganizacion: string;
  adminNombre: string;
  adminEmail: string;
  /** ADMIN por defecto; MEDICO además crea el perfil Medico. */
  rol: Extract<RolUsuario, "ADMIN" | "MEDICO">;
}

export interface CredencialesGeneradas {
  email: string;
  password: string;
  organizacion: string;
  rol: string;
}

/**
 * Activa una solicitud: crea (o reutiliza) la organización, crea el usuario
 * con una contraseña temporal aleatoria (bcrypt, 10 rounds como el resto del
 * sistema) y marca la solicitud ACTIVADO — todo en una transacción. La
 * contraseña en claro solo se devuelve aquí; nunca se persiste ni se registra.
 */
export async function activarSolicitud(
  input: ActivacionInput,
): Promise<CredencialesGeneradas> {
  const email = input.adminEmail.trim().toLowerCase();
  const password = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(password, 10);

  return prisma.$transaction(async (tx) => {
    const solicitud = await tx.solicitudAcceso.findUnique({
      where: { id: input.solicitudId },
    });
    if (!solicitud) throw new SolicitudNoEncontradaError();
    if (solicitud.estado === "ACTIVADO" || solicitud.estado === "RECHAZADO") {
      throw new SolicitudYaResueltaError();
    }

    const existente = await tx.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existente) throw new EmailEnUsoError();

    let organizacion: { id: string; nombre: string };
    if (input.organizacionId) {
      const org = await tx.organizacion.findUnique({
        where: { id: input.organizacionId },
        select: { id: true, nombre: true },
      });
      if (!org) throw new OrganizacionNoEncontradaError();
      organizacion = org;
    } else {
      organizacion = await tx.organizacion.create({
        data: { nombre: input.nombreOrganizacion.trim() },
        select: { id: true, nombre: true },
      });
    }

    const usuario = await tx.usuario.create({
      data: {
        organizacionId: organizacion.id,
        nombre: input.adminNombre.trim(),
        email,
        passwordHash,
        rol: input.rol,
      },
      select: { id: true },
    });

    if (input.rol === "MEDICO") {
      await tx.medico.create({
        data: {
          usuarioId: usuario.id,
          organizacionId: organizacion.id,
          especialidad: solicitud.especialidad,
        },
      });
    }

    await tx.solicitudAcceso.update({
      where: { id: solicitud.id },
      data: { estado: "ACTIVADO", organizacionId: organizacion.id },
    });

    return {
      email,
      password,
      organizacion: organizacion.nombre,
      rol: input.rol,
    };
  });
}

/** Cambia el estado de una solicitud abierta sin crear nada. */
export async function cambiarEstadoSolicitud(
  solicitudId: string,
  estado: "CONTACTADO" | "RECHAZADO",
) {
  const solicitud = await prisma.solicitudAcceso.findUnique({
    where: { id: solicitudId },
    select: { estado: true },
  });
  if (!solicitud) throw new SolicitudNoEncontradaError();
  if (solicitud.estado === "ACTIVADO" || solicitud.estado === "RECHAZADO") {
    throw new SolicitudYaResueltaError();
  }
  await prisma.solicitudAcceso.update({
    where: { id: solicitudId },
    data: { estado },
  });
}

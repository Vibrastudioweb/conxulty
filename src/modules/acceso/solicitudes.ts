import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { RolUsuario } from "@prisma/client";
import { prisma } from "@/db/client";

export class SolicitudNoActivableError extends Error {
  constructor() {
    super("La solicitud no existe o ya fue procesada.");
    this.name = "SolicitudNoActivableError";
  }
}

export class EmailYaRegistradoError extends Error {
  constructor() {
    super("Ya existe un usuario con ese correo.");
    this.name = "EmailYaRegistradoError";
  }
}

export class OrganizacionNoEncontradaError extends Error {
  constructor() {
    super("La organización seleccionada no existe.");
    this.name = "OrganizacionNoEncontradaError";
  }
}

// Sin 0/O/1/l/I: la contraseña se copia y se manda por WhatsApp, y los
// caracteres ambiguos generan errores de transcripción.
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

export function generarPasswordTemporal(longitud = 16): string {
  let resultado = "";
  for (let i = 0; i < longitud; i++) {
    resultado += ALFABETO[randomInt(ALFABETO.length)];
  }
  return resultado;
}

export async function crearSolicitud(input: {
  nombre: string;
  email: string;
  telefono: string;
  especialidad: string | null;
  nombreConsultorio: string;
}) {
  return prisma.solicitudAcceso.create({ data: input });
}

const ORDEN_ESTADO = { PENDIENTE: 0, CONTACTADO: 1, ACTIVADO: 2, RECHAZADO: 3 };

/** PENDIENTE primero, luego CONTACTADO, ACTIVADO, RECHAZADO; más recientes arriba. */
export async function listarSolicitudes() {
  const solicitudes = await prisma.solicitudAcceso.findMany({
    orderBy: { createdAt: "desc" },
  });
  return solicitudes.sort(
    (a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado],
  );
}

export async function obtenerSolicitud(id: string) {
  return prisma.solicitudAcceso.findUnique({ where: { id } });
}

export async function listarOrganizaciones() {
  return prisma.organizacion.findMany({
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });
}

/** Solo transita desde estados abiertos: una ACTIVADA no se puede rechazar. */
export async function cambiarEstadoSolicitud(
  id: string,
  estado: "CONTACTADO" | "RECHAZADO",
) {
  const { count } = await prisma.solicitudAcceso.updateMany({
    where: { id, estado: { in: ["PENDIENTE", "CONTACTADO"] } },
    data: { estado },
  });
  if (count === 0) throw new SolicitudNoActivableError();
}

/**
 * Activa una solicitud: crea (o reutiliza) la organización y el usuario, y
 * marca la solicitud ACTIVADO, todo en una transacción. La contraseña
 * temporal solo existe en el valor de retorno: no se persiste en claro.
 */
export async function activarSolicitud(input: {
  solicitudId: string;
  organizacionId: string | null;
  nombreOrganizacion: string;
  nombreUsuario: string;
  email: string;
  rol: Extract<RolUsuario, "ADMIN" | "MEDICO">;
}) {
  const password = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(password, 10);

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      // updateMany condicionado actúa como candado: dos clics simultáneos
      // no pueden activar la misma solicitud dos veces.
      const reclamada = await tx.solicitudAcceso.updateMany({
        where: {
          id: input.solicitudId,
          estado: { in: ["PENDIENTE", "CONTACTADO"] },
        },
        data: { estado: "ACTIVADO" },
      });
      if (reclamada.count === 0) throw new SolicitudNoActivableError();

      const solicitud = await tx.solicitudAcceso.findUniqueOrThrow({
        where: { id: input.solicitudId },
        select: { especialidad: true },
      });

      let organizacion: { id: string; nombre: string };
      if (input.organizacionId) {
        const existente = await tx.organizacion.findUnique({
          where: { id: input.organizacionId },
          select: { id: true, nombre: true },
        });
        if (!existente) throw new OrganizacionNoEncontradaError();
        organizacion = existente;
      } else {
        organizacion = await tx.organizacion.create({
          data: { nombre: input.nombreOrganizacion },
          select: { id: true, nombre: true },
        });
      }

      const usuario = await tx.usuario.create({
        data: {
          organizacionId: organizacion.id,
          nombre: input.nombreUsuario,
          email: input.email,
          passwordHash,
          rol: input.rol,
        },
        select: { id: true, email: true },
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

      return { organizacion, email: usuario.email };
    });

    return { ...resultado, password };
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new EmailYaRegistradoError();
    }
    throw err;
  }
}

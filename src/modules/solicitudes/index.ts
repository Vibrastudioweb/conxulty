import { z } from "zod";
import { prisma } from "@/db/client";
import { notificarNuevaSolicitud } from "./email";

/**
 * Solicitud pública de acceso. NO crea usuario ni organización: solo deja
 * constancia para que el súper-admin la revise (ver modules/superadmin).
 */

const texto = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

export const solicitudSchema = z.object({
  nombre: texto(2, 120),
  email: z.string().trim().toLowerCase().email().max(160),
  telefono: z
    .string()
    .trim()
    .min(6)
    .max(30)
    .regex(/^[0-9+()\-.\s]+$/, "Teléfono inválido"),
  especialidad: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v ? v : null)),
  nombreConsultorio: texto(2, 160),
});

export type ResultadoSolicitud =
  | { estado: "creada" }
  | { estado: "duplicada" }
  | { estado: "ignorada" }
  | { estado: "limite" }
  | { estado: "invalida"; campos: string[] };

// Limitador por IP en memoria: 5 solicitudes por 10 minutos por instancia.
// Es una defensa básica contra abuso del formulario público, no un control
// distribuido (en Render con varias instancias cada una cuenta aparte).
const VENTANA_MS = 10 * 60 * 1000;
const MAX_POR_VENTANA = 5;
const intentos = new Map<string, number[]>();

function excedeLimite(ip: string): boolean {
  const ahora = Date.now();
  const recientes = (intentos.get(ip) ?? []).filter((t) => ahora - t < VENTANA_MS);
  if (recientes.length >= MAX_POR_VENTANA) {
    intentos.set(ip, recientes);
    return true;
  }
  recientes.push(ahora);
  intentos.set(ip, recientes);
  return false;
}

/** Ventana en la que un mismo email no genera una segunda solicitud abierta. */
const DUPLICADO_DIAS = 7;

export async function crearSolicitudAcceso(
  crudo: unknown,
  contexto: { ip: string; honeypot?: string | null },
): Promise<ResultadoSolicitud> {
  // Honeypot: un campo oculto que un humano no llena. Se responde "ok" sin
  // guardar nada para no darle señal al bot.
  if (contexto.honeypot && contexto.honeypot.trim() !== "") {
    return { estado: "ignorada" };
  }

  const parseo = solicitudSchema.safeParse(crudo);
  if (!parseo.success) {
    const campos = Array.from(
      new Set(parseo.error.issues.map((i) => String(i.path[0] ?? ""))),
    ).filter(Boolean);
    return { estado: "invalida", campos };
  }

  if (excedeLimite(contexto.ip)) {
    return { estado: "limite" };
  }

  const datos = parseo.data;

  // Si ya hay una solicitud abierta reciente del mismo email, no se duplica
  // (ni se vuelve a notificar): el formulario responde igual de bien.
  const desde = new Date(Date.now() - DUPLICADO_DIAS * 24 * 60 * 60 * 1000);
  const existente = await prisma.solicitudAcceso.findFirst({
    where: {
      email: datos.email,
      estado: { in: ["PENDIENTE", "CONTACTADO"] },
      createdAt: { gte: desde },
    },
    select: { id: true },
  });
  if (existente) {
    return { estado: "duplicada" };
  }

  await prisma.solicitudAcceso.create({
    data: {
      nombre: datos.nombre,
      email: datos.email,
      telefono: datos.telefono,
      especialidad: datos.especialidad,
      nombreConsultorio: datos.nombreConsultorio,
    },
  });

  // La solicitud ya está guardada; el aviso por email no puede romperla.
  await notificarNuevaSolicitud({
    nombre: datos.nombre,
    nombreConsultorio: datos.nombreConsultorio,
    email: datos.email,
    telefono: datos.telefono,
    especialidad: datos.especialidad,
  });

  return { estado: "creada" };
}

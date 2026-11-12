import crypto from "node:crypto";
import { prisma } from "@/db/client";

/**
 * Freno contra fuerza bruta en el login (12-nov-2026, auditoría
 * pre-lanzamiento, hallazgo A3): hasta hoy se podían probar contraseñas
 * sin límite contra cualquier correo.
 *
 * Regla: 10 intentos fallidos para un mismo correo en 15 minutos bloquean
 * ese correo hasta que la ventana se vacíe sola. Se cuenta por correo (no
 * por IP): la IP se cambia fácil y detrás de un mismo router de consultorio
 * hay varias personas. Costo conocido de esa elección: alguien puede
 * bloquear a propósito el correo de otro durante 15 minutos — se acepta,
 * es mucho menos grave que dejar adivinar la contraseña.
 *
 * Todo acá FALLA ABIERTO: si la tabla `intentos_acceso` todavía no existe
 * (código desplegado antes de correr la migración) o la base no responde,
 * el login sigue funcionando sin freno en vez de dejar a todos afuera.
 */

const VENTANA_MS = 15 * 60 * 1000;
const MAXIMO_FALLOS = 10;

export function normalizarClaveAcceso(email: string): string {
  return email.trim().toLowerCase();
}

export async function accesoBloqueado(email: string): Promise<boolean> {
  const clave = normalizarClaveAcceso(email);
  if (!clave) return false;
  try {
    const fallos = await prisma.intentoAcceso.count({
      where: { clave, createdAt: { gte: new Date(Date.now() - VENTANA_MS) } },
    });
    return fallos >= MAXIMO_FALLOS;
  } catch (err) {
    console.error("[acceso] No se pudo consultar intentos_acceso (falla abierto):", err);
    return false;
  }
}

export async function registrarFalloAcceso(email: string): Promise<void> {
  const clave = normalizarClaveAcceso(email);
  if (!clave) return;
  try {
    await prisma.intentoAcceso.create({ data: { clave } });
    // Limpieza oportunista (1 de cada ~20 fallos): los correos que nunca
    // llegan a un login correcto no pasan por `limpiarFallosAcceso`, así
    // que sin esto sus filas viejas quedarían para siempre.
    if (Math.random() < 0.05) {
      await prisma.intentoAcceso.deleteMany({
        where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      });
    }
  } catch (err) {
    console.error("[acceso] No se pudo registrar el intento fallido:", err);
  }
}

/** Un login correcto limpia el historial de ese correo — y de paso evita
 *  que la tabla crezca sin tope. */
export async function limpiarFallosAcceso(email: string): Promise<void> {
  const clave = normalizarClaveAcceso(email);
  if (!clave) return;
  try {
    await prisma.intentoAcceso.deleteMany({ where: { clave } });
  } catch (err) {
    console.error("[acceso] No se pudo limpiar intentos_acceso:", err);
  }
}

/**
 * Tope de pedidos de "Olvidé mi contraseña" (auditoría, A3): 3 por correo
 * por hora. Usa la misma tabla con otro prefijo de clave, así los pedidos
 * de recuperación no cuentan como contraseñas fallidas ni al revés — y
 * `limpiarFallosAcceso` (que borra por clave exacta) no los toca.
 */
const VENTANA_RECUPERACION_MS = 60 * 60 * 1000;
const MAXIMO_PEDIDOS_RECUPERACION = 3;

function claveRecuperacion(email: string): string {
  return `recuperar:${normalizarClaveAcceso(email)}`;
}

export async function recuperacionBloqueada(email: string): Promise<boolean> {
  try {
    const pedidos = await prisma.intentoAcceso.count({
      where: {
        clave: claveRecuperacion(email),
        createdAt: { gte: new Date(Date.now() - VENTANA_RECUPERACION_MS) },
      },
    });
    return pedidos >= MAXIMO_PEDIDOS_RECUPERACION;
  } catch (err) {
    console.error("[acceso] No se pudo consultar intentos_acceso (falla abierto):", err);
    return false;
  }
}

export async function registrarPedidoRecuperacion(email: string): Promise<void> {
  try {
    await prisma.intentoAcceso.create({ data: { clave: claveRecuperacion(email) } });
  } catch (err) {
    console.error("[acceso] No se pudo registrar el pedido de recuperación:", err);
  }
}

/**
 * Freno de la reserva pública de citas por conexión de origen (12-nov-2026,
 * auditoría, hallazgo A1): 5 reservas por hora desde una misma IP. La IP la
 * manda el Directorio (vitalud), que es quien ve al visitante; acá nunca se
 * guarda en claro, solo un HMAC — alcanza para contar y no deja en la base
 * un registro de quién reservó desde dónde.
 *
 * Inserta primero y cuenta después (al revés que el login): así, si llegan
 * 50 pedidos en paralelo, todos se ven entre sí y se rechazan, en vez de
 * pasar todos por haber contado antes de que ninguno quedara anotado.
 *
 * Límite conocido: en Venezuela muchas líneas móviles salen por una misma
 * IP compartida. Con pocos médicos el tope no debería tocar a nadie real;
 * si empieza a pasar, se sube MAXIMO_RESERVAS_POR_ORIGEN.
 */
const VENTANA_RESERVAS_MS = 60 * 60 * 1000;
const MAXIMO_RESERVAS_POR_ORIGEN = 5;

function claveOrigenReserva(ip: string): string {
  const huella = crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "conxulty")
    .update(ip.trim())
    .digest("hex")
    .slice(0, 32);
  return `reserva:${huella}`;
}

/**
 * Anota el intento y dice si esa conexión ya pasó el tope. Devuelve el id
 * de la marca para poder devolverla con `devolverMarcaReserva` cuando la
 * reserva no llegó a crearse (horario ocupado, datos inválidos): un
 * paciente que prueba dos horarios tomados no debería gastar su cupo.
 */
export async function anotarReservaDeOrigen(
  ip: string,
): Promise<{ bloqueada: boolean; marcaId: string | null }> {
  if (!ip.trim()) return { bloqueada: false, marcaId: null };
  const clave = claveOrigenReserva(ip);
  try {
    const marca = await prisma.intentoAcceso.create({ data: { clave }, select: { id: true } });
    const total = await prisma.intentoAcceso.count({
      where: { clave, createdAt: { gte: new Date(Date.now() - VENTANA_RESERVAS_MS) } },
    });
    if (total > MAXIMO_RESERVAS_POR_ORIGEN) {
      await prisma.intentoAcceso.delete({ where: { id: marca.id } }).catch(() => undefined);
      return { bloqueada: true, marcaId: null };
    }
    return { bloqueada: false, marcaId: marca.id };
  } catch (err) {
    console.error("[acceso] No se pudo aplicar el freno de reservas (falla abierto):", err);
    return { bloqueada: false, marcaId: null };
  }
}

export async function devolverMarcaReserva(marcaId: string | null): Promise<void> {
  if (!marcaId) return;
  try {
    await prisma.intentoAcceso.delete({ where: { id: marcaId } });
  } catch (err) {
    console.error("[acceso] No se pudo devolver la marca de reserva:", err);
  }
}

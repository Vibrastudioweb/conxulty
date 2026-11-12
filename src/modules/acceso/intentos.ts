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

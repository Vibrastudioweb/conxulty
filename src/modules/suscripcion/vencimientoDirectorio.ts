import { prisma } from "@/db/client";

/**
 * Qué fecha de vencimiento mandarle al Directorio para la ficha de una
 * organización (hallazgo ALTO de la auditoría Bloque 2, 13-nov-2026).
 *
 * El problema que resuelve: el Directorio ya decide si muestra el
 * teléfono/WhatsApp y el botón de agendar con `plan_activo(ficha_id)`,
 * que respeta `suscripciones.vence`. Pero el OS creaba esa fila UNA vez,
 * `activa` y sin vencimiento, y no la volvía a tocar nunca — ni al
 * terminar el mes gratis, ni al confirmar un pago. O sea: cualquiera se
 * registraba, usaba el mes de regalo y conservaba para siempre su ficha
 * completa sin pagar. El plan Ficha de $5 era de honor.
 *
 * Decisión del founder (13-nov-2026): se corta a los 15 días del
 * vencimiento, no el mismo día — da tiempo a llamar y cobrar antes de
 * que el médico pierda llamadas. La ficha NUNCA se baja del Directorio:
 * sigue listada con nombre, especialidad y ubicación; lo único que se
 * apaga es el contacto y la reserva en línea.
 *
 * No hace falta ninguna tarea programada: la fecha se vence sola del
 * lado del Directorio.
 */
export const DIAS_GRACIA = 15;

/**
 * Tres respuestas distintas, y la diferencia importa:
 * - `undefined` → no tocar la suscripción del Directorio. Es el caso de
 *   una organización sin fila de Suscripcion (cuentas anteriores a este
 *   sistema) y de cualquier cambio manual que el equipo haya hecho allá:
 *   el OS no pisa lo que no administra.
 * - `null` → nunca vence (cortesía).
 * - `Date` → esa fecha.
 */
export async function vencimientoParaDirectorio(
  organizacionId: string,
): Promise<Date | null | undefined> {
  const suscripcion = await prisma.suscripcion.findUnique({
    where: { organizacionId },
    select: { estado: true, finPeriodoActual: true },
  });

  if (!suscripcion) return undefined;
  if (suscripcion.estado === "CORTESIA") return null;
  if (!suscripcion.finPeriodoActual) return undefined;

  const vence = new Date(suscripcion.finPeriodoActual);
  vence.setDate(vence.getDate() + DIAS_GRACIA);
  return vence;
}

/** 'YYYY-MM-DD' en hora de Venezuela — el Directorio compara contra
 *  `current_date`, no contra un instante, así que mandar un ISO completo
 *  con zona sería ruido que puede correr el día en el borde. */
export function fechaParaDirectorio(fecha: Date): string {
  return fecha.toLocaleDateString("en-CA", { timeZone: "America/Caracas" });
}

/** Lo que viaja en el cuerpo del POST/PATCH al Directorio: se omite el
 *  campo cuando no hay que tocar nada (JSON.stringify descarta
 *  `undefined`), y se manda `null` explícito para "nunca vence". */
export async function venceElParaDirectorio(
  organizacionId: string,
): Promise<string | null | undefined> {
  const vence = await vencimientoParaDirectorio(organizacionId);
  if (vence === undefined) return undefined;
  if (vence === null) return null;
  return fechaParaDirectorio(vence);
}

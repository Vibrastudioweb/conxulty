import { prisma } from "@/db/client";
import { PRECIO_CENTAVOS_USD } from "./precios";
import { actualizarVencimientoDirectorio } from "@/modules/directorio/sincronizacion";
import { venceElParaDirectorio } from "@/modules/suscripcion/vencimientoDirectorio";
import { notificarPagoReportado, notificarPagoConfirmado } from "./notificacionPago";

/**
 * Link de pago genérico en SPIDI (cuenta personal del usuario, confirmado
 * 09-nov-2026) — quien paga escribe el monto a mano, no hay forma de
 * fijarlo desde acá (eso requiere cuenta comercial + API, que no existe
 * hoy). Por eso el monto se muestra en pantalla ANTES del link, para que
 * el médico sepa exactamente cuánto escribir.
 */
export const SPIDI_LINK_PAGO = "https://mispidi.com/conxulty";

export class YaHayPagoPendienteError extends Error {
  constructor() {
    super("Ya hay un pago tuyo esperando confirmación — no hace falta registrar otro.");
    this.name = "YaHayPagoPendienteError";
  }
}

/** Tipos de imagen aceptados para el comprobante — capturas de pantalla
 *  normales de un teléfono o de SPIDI en el navegador, nada más. */
const TIPOS_COMPROBANTE_ACEPTADOS = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export class ComprobanteInvalidoError extends Error {
  constructor() {
    super("El comprobante debe ser una imagen (PNG, JPG o WEBP).");
    this.name = "ComprobanteInvalidoError";
  }
}

/**
 * El médico confirma "ya pagué" después de pasar por SPIDI_LINK_PAGO,
 * adjuntando la captura del comprobante en el mismo formulario (ver
 * changelog 10-nov-2026 — antes se mandaba aparte por WhatsApp, pedido
 * explícito del usuario: "no por whatsapp aca dentro"). No valida que el
 * pago haya ocurrido de verdad — eso lo sigue haciendo una persona en
 * /superadmin/pagos, ahora viendo el comprobante directo ahí en vez de en
 * WhatsApp. Esto solo dispara ese flujo: crea el `Pago` en PENDIENTE
 * (con el comprobante adjunto) y deja la `Suscripcion` en
 * PENDIENTE_CONFIRMACION.
 */
export async function registrarPagoRealizado(
  organizacionId: string,
  plan: "FICHA" | "PRO",
  comprobante: { bytes: Buffer; tipo: string } | null,
) {
  if (comprobante && !TIPOS_COMPROBANTE_ACEPTADOS.has(comprobante.tipo)) {
    throw new ComprobanteInvalidoError();
  }

  const suscripcion = await prisma.suscripcion.findUnique({
    where: { organizacionId },
    select: { id: true, estado: true },
  });

  if (suscripcion?.estado === "PENDIENTE_CONFIRMACION") {
    throw new YaHayPagoPendienteError();
  }

  await prisma.$transaction(async (tx) => {
    const sub = await tx.suscripcion.upsert({
      where: { organizacionId },
      create: { organizacionId, estado: "PENDIENTE_CONFIRMACION" },
      update: { estado: "PENDIENTE_CONFIRMACION" },
      select: { id: true },
    });

    await tx.pago.create({
      data: {
        organizacionId,
        suscripcionId: sub.id,
        plan,
        montoCentavos: PRECIO_CENTAVOS_USD[plan],
        estado: "PENDIENTE",
        // Prisma 7 tipa `Bytes` como Uint8Array<ArrayBuffer>, y un Buffer de
        // Node es Uint8Array<ArrayBufferLike> (admite SharedArrayBuffer) —
        // TS lo rechaza aunque en runtime un Buffer siempre funciona acá.
        // new Uint8Array(...) copia a un ArrayBuffer plano y satisface el tipo.
        comprobante: comprobante ? new Uint8Array(comprobante.bytes) : undefined,
        comprobanteTipo: comprobante?.tipo,
      },
    });
  });

  // Hasta hoy el circuito se quedaba mudo acá: el pago quedaba esperando
  // en /superadmin/pagos y nadie se enteraba (hallazgo de la auditoría
  // Bloque 2). Va después de la transacción y sin await en el camino
  // crítico de nada: el pago ya está guardado, el correo es el aviso.
  await notificarPagoReportado(organizacionId, plan);
}

export interface PagoPendienteVista {
  id: string;
  organizacionId: string;
  nombreOrganizacion: string;
  medicoNombre: string | null;
  medicoEmail: string | null;
  plan: "FICHA" | "PRO";
  montoCentavos: number;
  fecha: Date;
  /** data: URI listo para <img src>, o null si el médico no adjuntó nada
   *  (quedan algunos pagos viejos de antes de este campo, o alguien pudo
   *  seguir mandándolo por WhatsApp si el upload le falló). */
  comprobanteDataUrl: string | null;
}

export async function listarPagosPendientes(): Promise<PagoPendienteVista[]> {
  const pagos = await prisma.pago.findMany({
    where: { estado: "PENDIENTE" },
    orderBy: { fecha: "asc" },
    select: {
      id: true,
      organizacionId: true,
      plan: true,
      montoCentavos: true,
      fecha: true,
      comprobante: true,
      comprobanteTipo: true,
      organizacion: {
        select: {
          nombre: true,
          usuarios: {
            where: { rol: "MEDICO" },
            select: { nombre: true, email: true },
            take: 1,
          },
        },
      },
    },
  });

  return pagos.map((p) => ({
    id: p.id,
    organizacionId: p.organizacionId,
    nombreOrganizacion: p.organizacion.nombre,
    medicoNombre: p.organizacion.usuarios[0]?.nombre ?? null,
    comprobanteDataUrl:
      p.comprobante && p.comprobanteTipo
        ? `data:${p.comprobanteTipo};base64,${Buffer.from(p.comprobante).toString("base64")}`
        : null,
    medicoEmail: p.organizacion.usuarios[0]?.email ?? null,
    plan: p.plan,
    montoCentavos: p.montoCentavos,
    fecha: p.fecha,
  }));
}

const DIAS_PERIODO = 30;

/**
 * Confirma que el pago llegó de verdad (alguien del equipo lo vio en
 * SPIDI/el comprobante) — activa el plan, abre un periodo de 30 días desde
 * hoy, y es lo único que de verdad mueve `Organizacion.plan`.
 */
export async function confirmarPago(pagoId: string) {
  const pago = await prisma.pago.findUniqueOrThrow({
    where: { id: pagoId },
    select: { organizacionId: true, suscripcionId: true, plan: true, estado: true },
  });
  if (pago.estado !== "PENDIENTE") return;

  const inicioPeriodoActual = new Date();
  const finPeriodoActual = new Date(inicioPeriodoActual);
  finPeriodoActual.setDate(finPeriodoActual.getDate() + DIAS_PERIODO);

  await prisma.$transaction([
    prisma.pago.update({ where: { id: pagoId }, data: { estado: "PAGADO" } }),
    prisma.suscripcion.update({
      where: { id: pago.suscripcionId },
      data: {
        estado: "ACTIVA",
        planAlRenovar: null,
        inicioPeriodoActual,
        finPeriodoActual,
      },
    }),
    prisma.organizacion.update({
      where: { id: pago.organizacionId },
      data: { plan: pago.plan },
    }),
  ]);

  // El Directorio decide si muestra teléfono/WhatsApp y botón de agendar
  // con `plan_activo(ficha_id)`, que lee su propia fecha de vencimiento —
  // confirmar un pago acá sin empujar la fecha nueva allá dejaría la
  // ficha apagada aunque el médico ya esté al día (hallazgo ALTO de la
  // auditoría Bloque 2). Best effort: un Directorio caído no puede
  // impedir que se registre un pago que ya se recibió; el próximo
  // guardado de "Mi ficha pública" la vuelve a mandar igual.
  // Y del otro lado: el médico se entera de que su pago quedó confirmado
  // y hasta cuándo. Antes tenía que volver a entrar a /ajustes a ver si
  // alguien lo había procesado.
  await notificarPagoConfirmado(pago.organizacionId, pago.plan, finPeriodoActual);

  const organizacion = await prisma.organizacion.findUnique({
    where: { id: pago.organizacionId },
    select: { fichaDirectorioId: true },
  });
  if (organizacion?.fichaDirectorioId) {
    const venceEl = await venceElParaDirectorio(pago.organizacionId);
    if (venceEl !== undefined) {
      const resultado = await actualizarVencimientoDirectorio(organizacion.fichaDirectorioId, venceEl);
      if (!resultado.ok) {
        console.error("[pago] no se pudo actualizar el vencimiento en el Directorio:", resultado.error);
      }
    }
  }
}

/** El médico dijo que pagó pero no se encontró el comprobante/pago real. */
export async function rechazarPago(pagoId: string) {
  const pago = await prisma.pago.findUniqueOrThrow({
    where: { id: pagoId },
    select: { suscripcionId: true, estado: true },
  });
  if (pago.estado !== "PENDIENTE") return;

  await prisma.$transaction([
    prisma.pago.update({ where: { id: pagoId }, data: { estado: "FALLIDO" } }),
    prisma.suscripcion.update({
      where: { id: pago.suscripcionId },
      data: { estado: "SIN_METODO_DE_PAGO" },
    }),
  ]);
}

/** El médico pide bajar de Pro a Ficha — al final del periodo pagado (ver changelog punto 89, asumido por falta de respuesta explícita). */
export async function pedirBajaAFicha(organizacionId: string) {
  await prisma.suscripcion.update({
    where: { organizacionId },
    data: { planAlRenovar: "FICHA" },
  });
}

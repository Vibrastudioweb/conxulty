import { prisma } from "@/db/client";
import { INFO_METODO_PAGO } from "@/modules/cobros-caja/metodosPago";

/** "COB-" + el número correlativo, con ceros a la izquierda (ver changelog punto 13/48). */
export function formatearFolio(numero: number): string {
  return `COB-${String(numero).padStart(6, "0")}`;
}

/**
 * Normaliza un teléfono guardado en texto libre al formato que necesita un
 * link `wa.me` (solo dígitos, con código de país, sin "+"). HECHO a
 * verificar más adelante si CONXULTY opera fuera de Venezuela: hoy asume
 * que un teléfono de 10-11 dígitos empezando en "0" es un número
 * venezolano local y le antepone "58" quitando el 0 — ver changelog punto
 * 13/48. Devuelve `null` si no hay suficientes dígitos para ser un
 * teléfono real (no intenta adivinar).
 */
export function formatearTelefonoWhatsApp(telefono: string | null | undefined): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length < 7) return null;

  if (digitos.startsWith("58")) return digitos;
  if (digitos.startsWith("0") && digitos.length >= 10) return `58${digitos.slice(1)}`;
  if (digitos.length === 10) return `58${digitos}`;
  return digitos;
}

/** Construye la URL `https://wa.me/...` con el texto ya codificado. */
export function construirLinkWhatsApp(telefonoWa: string, texto: string): string {
  return `https://wa.me/${telefonoWa}?text=${encodeURIComponent(texto)}`;
}

export interface ComprobanteReceta {
  medicamentos: Array<{ nombre: string; indicaciones: string }>;
  indicacionesGenerales: string | null;
  fechaEmision: Date;
}

export interface Comprobante {
  cobroId: string;
  folio: string;
  fecha: Date;
  metodoPagoLabel: string;
  moneda: "USD" | "Bs";
  concepto: string | null;
  subtotal: string;
  descuentoMonto: string;
  descuentoMotivo: string | null;
  total: string;
  paciente: { nombre: string; apellido: string; telefono: string | null } | null;
  recetas: ComprobanteReceta[];
}

/**
 * Datos completos de un cobro para la pantalla de comprobante (ver
 * changelog punto 13/48): incluye las recetas de la consulta de origen (si
 * el cobro viene de una consulta y esa consulta tiene documentos tipo
 * RECETA) para que el botón de WhatsApp pueda incluirlas en el mensaje.
 */
export async function obtenerComprobante(input: {
  organizacionId: string;
  cobroId: string;
}): Promise<Comprobante | null> {
  const cobro = await prisma.cobro.findFirst({
    where: { id: input.cobroId, organizacionId: input.organizacionId },
    include: {
      paciente: { select: { nombre: true, apellido: true, telefono: true } },
      consulta: {
        select: {
          documentos: {
            where: { tipo: "RECETA" },
            select: { contenido: true, fechaEmision: true },
            orderBy: { fechaEmision: "desc" },
          },
        },
      },
    },
  });

  if (!cobro) return null;

  const subtotal = cobro.monto.plus(cobro.descuentoMonto);
  const info = INFO_METODO_PAGO[cobro.metodoPago];

  const recetas: ComprobanteReceta[] = (cobro.consulta?.documentos ?? []).map((doc) => {
    const contenido = doc.contenido as unknown as {
      medicamentos: Array<{ nombre: string; indicaciones: string }>;
      indicacionesGenerales: string | null;
    };
    return {
      medicamentos: contenido.medicamentos,
      indicacionesGenerales: contenido.indicacionesGenerales,
      fechaEmision: doc.fechaEmision,
    };
  });

  return {
    cobroId: cobro.id,
    folio: formatearFolio(cobro.numero),
    fecha: cobro.fecha,
    metodoPagoLabel: info.label,
    moneda: info.moneda,
    concepto: cobro.concepto,
    subtotal: subtotal.toString(),
    descuentoMonto: cobro.descuentoMonto.toString(),
    descuentoMotivo: cobro.descuentoMotivo,
    total: cobro.monto.toString(),
    paciente: cobro.paciente,
    recetas,
  };
}

/** Texto plano para el mensaje de WhatsApp — comprobante + recetas si hay. */
export function construirMensajeWhatsApp(comprobante: Comprobante, nombreOrganizacion: string): string {
  const simbolo = comprobante.moneda === "USD" ? "$" : "Bs";
  const lineas: string[] = [
    `*${nombreOrganizacion}*`,
    `Comprobante ${comprobante.folio}`,
    `Fecha: ${comprobante.fecha.toLocaleString("es")}`,
  ];

  if (comprobante.concepto) {
    lineas.push(`Concepto: ${comprobante.concepto}`);
  }
  lineas.push(`Método de pago: ${comprobante.metodoPagoLabel}`);

  if (Number(comprobante.descuentoMonto) > 0) {
    lineas.push(`Subtotal: ${simbolo}${comprobante.subtotal}`);
    lineas.push(`Descuento (${comprobante.descuentoMotivo}): -${simbolo}${comprobante.descuentoMonto}`);
  }
  lineas.push(`Total cobrado: ${simbolo}${comprobante.total}`);

  if (comprobante.recetas.length > 0) {
    lineas.push("", "*Receta médica*");
    for (const receta of comprobante.recetas) {
      for (const med of receta.medicamentos) {
        lineas.push(`• ${med.nombre} — ${med.indicaciones}`);
      }
      if (receta.indicacionesGenerales) {
        lineas.push(`Indicaciones: ${receta.indicacionesGenerales}`);
      }
    }
  }

  return lineas.join("\n");
}

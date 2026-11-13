import { prisma } from "@/db/client";
import { enviarCorreo, urlBase } from "@/modules/correo/enviar";
import { precioFormateado } from "./precios";
import type { PlanOrganizacion } from "@prisma/client";

/**
 * Avisos de los dos lados del cobro manual (13-nov-2026, hallazgo de la
 * auditoría Bloque 2).
 *
 * El problema que resuelve: el cobro es manual de punta a punta (cuenta
 * personal de SPIDI, sin API — ver pagoManual.ts). El médico paga, sube su
 * comprobante, y ahí el circuito se quedaba mudo: nadie se enteraba de que
 * había un pago esperando confirmación. Dependía de que alguien se
 * acordara de abrir /superadmin/pagos. Si pasaban días, el médico ya había
 * pagado y su cuenta seguía diciendo "pendiente" — y desde que la fecha de
 * vencimiento viaja al Directorio, su ficha podía llegar a apagarse
 * teniendo el pago hecho.
 *
 * Dos correos, uno por punta: al equipo cuando entra un pago, y al médico
 * cuando se le confirma. Ninguno de los dos es crítico — el pago ya está
 * guardado cuando se llama acá, y `enviarCorreo` nunca lanza.
 */

const DESTINO_POR_DEFECTO = "soporte@conxulty.com";

function destinoEquipo(): string {
  return process.env.PAGOS_EMAIL_TO ?? process.env.SOLICITUDES_EMAIL_TO ?? DESTINO_POR_DEFECTO;
}

function fechaLarga(d: Date): string {
  return d.toLocaleDateString("es-VE", {
    timeZone: "America/Caracas",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** El médico de la organización — es quien paga y a quien se le confirma. */
async function medicoDeOrganizacion(
  organizacionId: string,
): Promise<{ nombre: string; email: string } | null> {
  const usuario = await prisma.usuario.findFirst({
    where: { organizacionId, rol: "MEDICO" },
    select: { nombre: true, email: true },
    orderBy: { createdAt: "asc" },
  });
  return usuario ?? null;
}

/** Al equipo: entró un pago y hay que confirmarlo. */
export async function notificarPagoReportado(
  organizacionId: string,
  plan: PlanOrganizacion,
): Promise<void> {
  const [organizacion, medico] = await Promise.all([
    prisma.organizacion.findUnique({
      where: { id: organizacionId },
      select: { nombre: true },
    }),
    medicoDeOrganizacion(organizacionId),
  ]);

  const nombreConsultorio = organizacion?.nombre ?? "(consultorio sin nombre)";
  const nombrePlan = plan === "PRO" ? "Pro" : "Ficha";

  await enviarCorreo({
    origen: "pagos",
    para: destinoEquipo(),
    responderA: medico?.email,
    asunto: `Pago por confirmar — ${nombreConsultorio} (plan ${nombrePlan})`,
    texto: [
      `${nombreConsultorio} reportó un pago del plan ${nombrePlan} por ${precioFormateado(plan)}.`,
      medico ? `Médico: ${medico.nombre} — ${medico.email}` : null,
      "",
      "El comprobante está adjunto en el panel. Confirmarlo activa su plan por 30 días;",
      "mientras tanto su cuenta sigue diciendo que el pago está pendiente.",
      "",
      `${urlBase()}/superadmin/pagos`,
    ]
      .filter((linea) => linea !== null)
      .join("\n"),
  });
}

/** Al médico: su pago quedó confirmado y hasta cuándo. */
export async function notificarPagoConfirmado(
  organizacionId: string,
  plan: PlanOrganizacion,
  finPeriodoActual: Date,
): Promise<void> {
  const medico = await medicoDeOrganizacion(organizacionId);
  if (!medico) return;

  const nombrePlan = plan === "PRO" ? "Pro" : "Ficha";

  await enviarCorreo({
    origen: "pagos",
    para: medico.email,
    asunto: `Confirmamos tu pago — plan ${nombrePlan} activo`,
    texto: [
      `Hola ${medico.nombre},`,
      "",
      `Recibimos tu pago del plan ${nombrePlan}. Tu cuenta queda al día hasta el ${fechaLarga(finPeriodoActual)}.`,
      "",
      `Puedes ver el estado de tu plan acá: ${urlBase()}/ajustes`,
      "",
      "Gracias.",
    ].join("\n"),
  });
}

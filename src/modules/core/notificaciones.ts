import { prisma } from "@/db/client";
import { obtenerCajaAbierta } from "@/modules/cobros-caja/caja";

export type AlertaTopbar = {
  id: string;
  mensaje: string;
  href: string;
  nivel: "info" | "warning";
};

/**
 * Alertas reales para la campanita de notificaciones del Topbar (29-oct-2026
 * — ver changelog de la demo, punto 12, y la instrucción de construir todo
 * "100% funcional"). A propósito NO hay nada inventado aquí: cada alerta
 * sale de una consulta real a la base de datos, y si no hay nada que
 * reportar, la lista vuelve vacía (sin relleno tipo "no tienes
 * notificaciones nuevas" con iconos decorativos).
 *
 * Alcance: por ORGANIZACIÓN, no por médico. El Topbar vive en AppShell, que
 * envuelve también las pantallas de ADMIN/STAFF (que no tienen un
 * `Medico.id` propio) — filtrar por médico dejaría el Topbar roto para
 * esos roles. Si más adelante se necesita una alerta específica del médico
 * en sesión (p.ej. "tus citas sin confirmar" en vez de las de toda la
 * organización), es una ampliación deliberada, no una corrección de esto.
 */
export async function obtenerAlertasTopbar(input: {
  organizacionId: string;
}): Promise<AlertaTopbar[]> {
  const ahora = new Date();
  const inicioHoy = new Date(ahora);
  inicioHoy.setHours(0, 0, 0, 0);
  const finHoy = new Date(inicioHoy);
  finHoy.setDate(finHoy.getDate() + 1);

  const [cajaAbierta, citasPendientesHoy, reservasDirectorioPendientes] = await Promise.all([
    obtenerCajaAbierta({ organizacionId: input.organizacionId }),
    prisma.cita.count({
      where: {
        organizacionId: input.organizacionId,
        estado: "PENDIENTE",
        fechaHora: { gte: inicioHoy, lt: finHoy },
      },
    }),
    // Reservas hechas por el paciente desde la ficha pública (origen
    // DIRECTORIO, ver citasPublicas.ts) — a diferencia de la alerta de
    // arriba, SIN filtro de fecha: una reserva para la próxima semana no
    // debía quedar sin avisar hasta el día mismo de la cita (10-nov-2026,
    // "cuando alguien reserva una cita por el directorio donde ve el
    // médico la cita para aprobar").
    prisma.cita.count({
      where: {
        organizacionId: input.organizacionId,
        estado: "PENDIENTE",
        origen: "DIRECTORIO",
      },
    }),
  ]);

  const alertas: AlertaTopbar[] = [];

  if (cajaAbierta && cajaAbierta.fechaApertura < inicioHoy) {
    const fechaTexto = cajaAbierta.fechaApertura.toLocaleDateString("es", {
      day: "numeric",
      month: "long",
    });
    alertas.push({
      id: "caja-abierta-otro-dia",
      mensaje: `Hay una caja abierta desde el ${fechaTexto}. Revísala antes de seguir cobrando.`,
      href: "/caja",
      nivel: "warning",
    });
  }

  if (citasPendientesHoy > 0) {
    alertas.push({
      id: "citas-pendientes-hoy",
      mensaje: `${citasPendientesHoy} ${
        citasPendientesHoy === 1
          ? "cita de hoy está"
          : "citas de hoy están"
      } sin confirmar.`,
      href: "/agenda",
      nivel: "info",
    });
  }

  if (reservasDirectorioPendientes > 0) {
    alertas.push({
      id: "reservas-directorio-pendientes",
      mensaje: `${reservasDirectorioPendientes} ${
        reservasDirectorioPendientes === 1
          ? "reserva en línea está"
          : "reservas en línea están"
      } pendientes de aprobar.`,
      href: "/agenda?estado=PENDIENTE",
      nivel: "info",
    });
  }

  return alertas;
}

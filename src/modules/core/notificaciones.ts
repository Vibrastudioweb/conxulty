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

  const [cajaAbierta, citasPendientesHoy] = await Promise.all([
    obtenerCajaAbierta({ organizacionId: input.organizacionId }),
    prisma.cita.count({
      where: {
        organizacionId: input.organizacionId,
        estado: "PENDIENTE",
        fechaHora: { gte: inicioHoy, lt: finHoy },
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

  return alertas;
}

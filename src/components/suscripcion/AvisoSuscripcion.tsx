import Link from "next/link";
import { obtenerEstadoSuscripcion } from "@/modules/suscripcion/obtenerSuscripcion";
import { precioFormateado } from "@/modules/suscripcion/precios";

/**
 * Recordatorio de pago dentro del OS (13-nov-2026, decisión del founder:
 * "nada automático, yo lo llamo"). Nada se bloquea al vencer — por eso el
 * texto nunca amenaza con cortar nada: avisa la fecha y el monto, y la
 * cobranza real la hace el equipo por fuera.
 *
 * Aparece solo para MEDICO: es quien decide y paga, y además /ajustes
 * exige ese rol (ver requireMedico), así que a un ADMIN el enlace no le
 * serviría.
 */
const DIAS_PARA_AVISAR = 7;

function diasHasta(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

function fechaCorta(d: Date): string {
  return d.toLocaleDateString("es-VE", { day: "numeric", month: "long" });
}

export async function AvisoSuscripcion({ organizacionId }: { organizacionId: string }) {
  const suscripcion = await obtenerEstadoSuscripcion(organizacionId);
  const fin = suscripcion.finPeriodoActual;

  if (suscripcion.estado === "PENDIENTE_CONFIRMACION") {
    return (
      <Banda tono="info">
        Recibimos tu aviso de pago. En cuanto el equipo lo confirme, tu plan queda
        activo por 30 días.
      </Banda>
    );
  }

  if (!fin) return null;

  const dias = diasHasta(fin);
  if (dias > DIAS_PARA_AVISAR) return null;

  const precio = precioFormateado(suscripcion.planActual);
  const vencido = dias < 0;
  const enPrueba = suscripcion.estado === "PRUEBA";

  return (
    <Banda tono={vencido ? "alerta" : "info"}>
      {enPrueba
        ? vencido
          ? `Tu mes gratis terminó el ${fechaCorta(fin)}. El plan Ficha cuesta ${precio} al mes.`
          : `Tu mes gratis termina el ${fechaCorta(fin)}. Después, el plan Ficha cuesta ${precio} al mes.`
        : vencido
          ? `Tu plan ${suscripcion.planActual === "PRO" ? "Pro" : "Ficha"} venció el ${fechaCorta(fin)}.`
          : `Tu plan vence el ${fechaCorta(fin)}.`}{" "}
      <Link href="/ajustes" className="font-semibold underline">
        Ver cómo pagar
      </Link>
    </Banda>
  );
}

function Banda({
  tono,
  children,
}: {
  tono: "info" | "alerta";
  children: React.ReactNode;
}) {
  const colores =
    tono === "alerta"
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-border bg-surface-muted text-text-secondary";
  return (
    <div className={`border-b px-4 py-2 text-body-secondary lg:px-8 ${colores}`}>
      {children}
    </div>
  );
}

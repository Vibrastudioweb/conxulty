import { prisma } from "@/db/client";
import { requireMedico } from "@/modules/core/autorizacion";
import { obtenerEstadoSuscripcion } from "@/modules/suscripcion/obtenerSuscripcion";
import { precioFormateado } from "@/modules/suscripcion/precios";
import { SPIDI_LINK_PAGO } from "@/modules/suscripcion/pagoManual";
import { esProfesionElegiblePro } from "@/modules/onboarding/profesiones";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { confirmarPagoRealizadoAction, pedirBajaAFichaAction } from "./actions";

export const metadata = { title: "Configuración — CONXULTY" };

const ETIQUETA_PLAN: Record<"FICHA" | "PRO", string> = {
  FICHA: "Ficha",
  PRO: "Pro",
};

export default async function AjustesPage() {
  const session = await requireMedico();
  const organizacionId = session.user.organizacionId;

  const [suscripcion, medico, pagos] = await Promise.all([
    obtenerEstadoSuscripcion(organizacionId),
    prisma.medico.findFirst({
      where: { organizacionId },
      select: { profesion: true },
    }),
    prisma.pago.findMany({
      where: { organizacionId },
      orderBy: { fecha: "desc" },
      take: 12,
    }),
  ]);

  const elegiblePro = medico ? esProfesionElegiblePro(medico.profesion) : false;
  const estaEnInconsistencia =
    suscripcion.planActual === "PRO" && suscripcion.estado === "SIN_METODO_DE_PAGO";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Configuración"
        description="Tu plan, método de pago e historial de facturas."
      />

      {estaEnInconsistencia && (
        <div className="mt-4">
          <Alert tone="info" title="Plan Pro sin pago registrado">
            Elegiste Pro al crear tu cuenta, antes de que el cobro real
            existiera — por ahora sigue activo sin que se te haya cobrado
            nada. Vas a tener que pagar normal la próxima vez que suba este
            plan.
          </Alert>
        </div>
      )}

      <section className="mt-6">
        <Card padding="spacious">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">
                Plan {ETIQUETA_PLAN[suscripcion.planActual]}
              </h2>
              <p className="mt-1 text-body-secondary text-text-secondary">
                {precioFormateado(suscripcion.planActual)}/mes
                {suscripcion.planAlRenovar && (
                  <>
                    {" "}
                    — pasa a {ETIQUETA_PLAN[suscripcion.planAlRenovar]} el{" "}
                    {suscripcion.finPeriodoActual?.toLocaleDateString("es-VE") ??
                      "fin del periodo"}
                  </>
                )}
              </p>
            </div>

            {suscripcion.planActual === "PRO" && !suscripcion.planAlRenovar && (
              <form action={pedirBajaAFichaAction}>
                <Button type="submit" size="sm" variant="secondary">
                  Bajar a Ficha
                </Button>
              </form>
            )}
          </div>
        </Card>
      </section>

      {suscripcion.planActual === "FICHA" && (
        <section className="mt-6">
          <h2 className="text-sm font-semibold text-text-primary">Subir a Pro</h2>
          <div className="mt-3">
            {suscripcion.estado === "PENDIENTE_CONFIRMACION" ? (
              <Alert tone="info" title="Revisando tu pago">
                Nos avisaste que ya pagaste — en cuanto el equipo lo confirme
                vas a quedar en Pro. Si no mandaste el comprobante todavía,
                hazlo por WhatsApp para que no se demore.
              </Alert>
            ) : !elegiblePro ? (
              <Card padding="spacious">
                <p className="text-body-secondary text-text-secondary">
                  Pro no está disponible todavía para tu profesión.
                </p>
              </Card>
            ) : (
              <Card padding="spacious">
                <p className="text-body-secondary text-text-primary">
                  Paga <strong>{precioFormateado("PRO")}</strong> en SPIDI y
                  confirma acá abajo — todavía no hay cobro automático, así
                  que el equipo revisa cada pago a mano.
                </p>
                <ol className="mt-3 list-decimal space-y-1 pl-5 text-body-secondary text-text-secondary">
                  <li>
                    Abre{" "}
                    <a
                      href={SPIDI_LINK_PAGO}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-brand-primary underline"
                    >
                      mispidi.com/conxulty
                    </a>{" "}
                    y paga exactamente {precioFormateado("PRO")}.
                  </li>
                  <li>Manda el comprobante por WhatsApp (botón de Soporte, abajo en el menú).</li>
                  <li>Confirma acá que ya pagaste.</li>
                </ol>
                <form action={confirmarPagoRealizadoAction} className="mt-4">
                  <input type="hidden" name="plan" value="PRO" />
                  <Button type="submit" size="sm">
                    Ya pagué {precioFormateado("PRO")}
                  </Button>
                </form>
              </Card>
            )}
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">Facturas</h2>
        <div className="mt-3">
          {pagos.length === 0 ? (
            <p className="text-body-secondary text-text-faint">
              Todavía no hay pagos registrados.
            </p>
          ) : (
            <ul className="space-y-2">
              {pagos.map((pago) => (
                <li key={pago.id}>
                  <Card padding="compact">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-body-secondary font-medium text-text-primary">
                          Plan {ETIQUETA_PLAN[pago.plan]}
                        </p>
                        <p className="text-caption text-text-faint">
                          {pago.fecha.toLocaleDateString("es-VE")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-body-secondary font-medium text-text-primary">
                          ${(pago.montoCentavos / 100).toFixed(0)}
                        </p>
                        <p className="text-caption text-text-faint">
                          {pago.estado === "PAGADO"
                            ? "Confirmado"
                            : pago.estado === "FALLIDO"
                              ? "No confirmado"
                              : "Esperando confirmación"}
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

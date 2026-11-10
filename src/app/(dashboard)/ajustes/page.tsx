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

const MENSAJES_ERROR_COMPROBANTE: Record<string, string> = {
  falta: "Adjunta la captura del comprobante antes de confirmar que pagaste.",
  muy_grande: "La imagen pesa demasiado — máximo 3MB. Prueba con una captura de pantalla normal (no una foto de alta resolución).",
  tipo_invalido: "El comprobante debe ser una imagen (PNG, JPG o WEBP).",
};

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ errorComprobante?: string }>;
}) {
  const session = await requireMedico();
  const organizacionId = session.user.organizacionId;
  const { errorComprobante } = await searchParams;

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
          <div className="mt-3 space-y-3">
            {errorComprobante && (
              <Alert tone="danger">
                {MENSAJES_ERROR_COMPROBANTE[errorComprobante] ?? "No se pudo registrar el pago."}
              </Alert>
            )}

            {suscripcion.estado === "PENDIENTE_CONFIRMACION" ? (
              <Alert tone="info" title="Revisando tu pago">
                Nos avisaste que ya pagaste y quedó tu comprobante guardado —
                en cuanto el equipo lo confirme vas a quedar en Pro.
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
                  que el equipo revisa cada pago a mano contra el comprobante
                  que adjuntes.
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
                  <li>Adjunta abajo la captura del comprobante y confirma.</li>
                </ol>
                <form action={confirmarPagoRealizadoAction} className="mt-4 space-y-3">
                  <input type="hidden" name="plan" value="PRO" />
                  <div>
                    <label
                      htmlFor="comprobante"
                      className="mb-1 block text-sm font-medium text-text-primary"
                    >
                      Captura del comprobante
                    </label>
                    <input
                      id="comprobante"
                      name="comprobante"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      required
                      className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-button file:border file:border-brand-primary file:bg-transparent file:px-3 file:py-1.5 file:text-caption file:font-semibold file:text-brand-primary hover:file:bg-brand-primary-soft"
                    />
                  </div>
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

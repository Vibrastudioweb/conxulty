import { prisma } from "@/db/client";
import { requireMedico } from "@/modules/core/autorizacion";
import { obtenerEstadoSuscripcion } from "@/modules/suscripcion/obtenerSuscripcion";
import { precioFormateado, PRECIO_CENTAVOS_USD } from "@/modules/suscripcion/precios";
import { SPIDI_LINK_PAGO } from "@/modules/suscripcion/pagoManual";
import { obtenerTasaBcv, montoEnBolivares, type TasaBcv } from "@/modules/suscripcion/tasaBcv";
import { NOMBRE_MODULO, type ModuloPro } from "@/modules/suscripcion/plan";
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
  muy_grande:
    "La imagen pesa demasiado — máximo 3MB. Prueba con una captura de pantalla normal (no una foto de alta resolución).",
  tipo_invalido: "El comprobante debe ser una imagen (PNG, JPG o WEBP).",
};

const QUE_TRAE_PRO = [
  "Consultas y notas clínicas",
  "Recetas y documentos",
  "Caja, cobros y gastos",
  "Reportes",
];

function fecha(d: Date): string {
  return d.toLocaleDateString("es-VE", { day: "numeric", month: "long", year: "numeric" });
}

function diasHasta(d: Date): number {
  return Math.ceil((d.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
}

/**
 * Tarjeta de pago de un plan (13-nov-2026, hallazgo C2). Antes solo
 * existía "Subir a Pro": Ficha no se cobraba en ninguna pantalla aunque
 * cuesta $5/mes pasado el primer mes. Ahora la misma tarjeta sirve para
 * pagar Ficha, subir a Pro o renovar.
 *
 * El monto en bolívares es lo que el médico tiene que escribir a mano en
 * SPIDI (la cuenta es personal, el link no lleva monto). Si la tasa no se
 * pudo traer se muestran solo los dólares, diciéndolo.
 */
function TarjetaPago({
  plan,
  titulo,
  descripcion,
  tasa,
  variante = "primary",
}: {
  plan: "FICHA" | "PRO";
  titulo: string;
  descripcion: React.ReactNode;
  tasa: TasaBcv | null;
  variante?: "primary" | "secondary";
}) {
  const usd = precioFormateado(plan);
  const bs = tasa ? montoEnBolivares(PRECIO_CENTAVOS_USD[plan], tasa) : null;

  return (
    <Card padding="spacious">
      <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
      <div className="mt-1 text-body-secondary text-text-secondary">{descripcion}</div>

      <div className="mt-3 rounded-card bg-surface-muted px-3 py-2">
        <p className="text-body-secondary text-text-primary">
          Monto a pagar: <strong>{bs ?? usd}</strong>
          {bs && <span className="text-text-secondary"> ({usd})</span>}
        </p>
        <p className="mt-0.5 text-caption text-text-faint">
          {bs
            ? `Al cambio del BCV de hoy, ${tasa!.bolivaresPorDolar.toLocaleString("es-VE", { maximumFractionDigits: 2 })} Bs/$. Escribe este monto en SPIDI.`
            : "No se pudo traer la tasa del BCV ahora mismo — convierte al cambio del día antes de pagar."}
        </p>
      </div>

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
          y paga ese monto.
        </li>
        <li>Adjunta abajo la captura del comprobante y confirma.</li>
      </ol>

      <form action={confirmarPagoRealizadoAction} className="mt-4 space-y-3">
        <input type="hidden" name="plan" value={plan} />
        <div>
          <label
            htmlFor={`comprobante-${plan}`}
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Captura del comprobante
          </label>
          <input
            id={`comprobante-${plan}`}
            name="comprobante"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
            className="block w-full text-sm text-text-secondary file:mr-3 file:rounded-button file:border file:border-brand-primary file:bg-transparent file:px-3 file:py-1.5 file:text-caption file:font-semibold file:text-brand-primary hover:file:bg-brand-primary-soft"
          />
        </div>
        <Button type="submit" size="sm" variant={variante}>
          Ya pagué {usd}
        </Button>
      </form>
    </Card>
  );
}

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: Promise<{ errorComprobante?: string; pro?: string }>;
}) {
  const session = await requireMedico();
  const organizacionId = session.user.organizacionId;
  const { errorComprobante, pro } = await searchParams;

  const [suscripcion, medico, pagos, tasa] = await Promise.all([
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
    obtenerTasaBcv(),
  ]);

  const elegiblePro = medico ? esProfesionElegiblePro(medico.profesion) : false;
  const esperandoConfirmacion = suscripcion.estado === "PENDIENTE_CONFIRMACION";
  const enPrueba = suscripcion.estado === "PRUEBA";
  const fin = suscripcion.finPeriodoActual;
  const diasRestantes = fin ? diasHasta(fin) : null;
  const vencido = diasRestantes !== null && diasRestantes < 0;

  // El módulo que el médico intentó abrir, si llegó acá desde la pantalla
  // de "esto es de Pro".
  const moduloPedido =
    pro && pro in NOMBRE_MODULO ? NOMBRE_MODULO[pro as ModuloPro] : null;

  return (
    // <main> como el resto de las pantallas del dashboard: el shell no
    // envuelve el contenido en un landmark, lo pone cada página (esta no
    // lo tenía).
    <main className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Configuración"
        description="Tu plan, cómo pagarlo e historial de pagos."
      />

      {moduloPedido && suscripcion.planActual === "FICHA" && (
        <div className="mt-4">
          <Alert tone="info" title={`${moduloPedido} viene con el plan Pro`}>
            Tu cuenta está en Ficha. Abajo está cómo pasar a Pro.
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
              </p>

              {enPrueba && fin && (
                <p className="mt-2 text-body-secondary text-text-primary">
                  {vencido ? (
                    <>Tu mes gratis terminó el {fecha(fin)}.</>
                  ) : (
                    <>
                      Mes gratis hasta el {fecha(fin)}
                      {diasRestantes !== null && diasRestantes <= 31 && (
                        <> · quedan {diasRestantes} {diasRestantes === 1 ? "día" : "días"}</>
                      )}
                      .
                    </>
                  )}
                </p>
              )}

              {!enPrueba && fin && suscripcion.estado === "ACTIVA" && (
                <p className="mt-2 text-body-secondary text-text-primary">
                  {vencido ? (
                    <>Tu último pago cubrió hasta el {fecha(fin)}.</>
                  ) : (
                    <>Pagado hasta el {fecha(fin)}.</>
                  )}
                </p>
              )}

              {suscripcion.planAlRenovar && fin && (
                <p className="mt-1 text-body-secondary text-text-secondary">
                  Pasa a {ETIQUETA_PLAN[suscripcion.planAlRenovar]} el {fecha(fin)}.
                </p>
              )}
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

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">
          {suscripcion.planActual === "FICHA" ? "Pagar" : "Renovar"}
        </h2>
        <div className="mt-3 space-y-3">
          {errorComprobante && (
            <Alert tone="danger">
              {MENSAJES_ERROR_COMPROBANTE[errorComprobante] ??
                "No se pudo registrar el pago."}
            </Alert>
          )}

          {esperandoConfirmacion ? (
            <Alert tone="info" title="Revisando tu pago">
              Nos avisaste que ya pagaste y tu comprobante quedó guardado. En cuanto
              el equipo lo confirme, tu plan queda activo por 30 días.
            </Alert>
          ) : (
            <>
              {suscripcion.planActual === "FICHA" && (
                <TarjetaPago
                  plan="FICHA"
                  titulo={enPrueba && !vencido ? "Seguir en Ficha" : "Pagar Ficha"}
                  descripcion={
                    <>
                      Tu ficha pública en el Directorio, agenda y pacientes.
                      {enPrueba && !vencido && fin && (
                        <> Puedes pagar ya; el mes se cuenta desde que se confirme.</>
                      )}
                    </>
                  }
                  tasa={tasa}
                  variante="secondary"
                />
              )}

              {suscripcion.planActual === "FICHA" && !elegiblePro && (
                <Card padding="spacious">
                  <p className="text-body-secondary text-text-secondary">
                    Pro no está disponible todavía para tu profesión.
                  </p>
                </Card>
              )}

              {suscripcion.planActual === "FICHA" && elegiblePro && (
                <TarjetaPago
                  plan="PRO"
                  titulo="Subir a Pro"
                  descripcion={
                    <>
                      Todo lo de Ficha, más:
                      <ul className="mt-1 list-disc space-y-0.5 pl-5">
                        {QUE_TRAE_PRO.map((linea) => (
                          <li key={linea}>{linea}</li>
                        ))}
                      </ul>
                      <span className="mt-1 block">Pro no tiene mes gratis.</span>
                    </>
                  }
                  tasa={tasa}
                />
              )}

              {suscripcion.planActual === "PRO" && (
                <TarjetaPago
                  plan="PRO"
                  titulo="Renovar Pro"
                  descripcion={<>Otro mes de Pro, con todo lo que ya tienes activo.</>}
                  tasa={tasa}
                />
              )}
            </>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">Pagos</h2>
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
    </main>
  );
}

import { prisma } from "@/db/client";
import { requireMedico } from "@/modules/core/autorizacion";
import { obtenerEstadoSuscripcion } from "@/modules/suscripcion/obtenerSuscripcion";
import { precioFormateado } from "@/modules/suscripcion/precios";
import { esProfesionElegiblePro } from "@/modules/onboarding/profesiones";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { CambiarPlanBoton } from "./CambiarPlanBoton";

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
      <h1 className="text-h2 font-semibold text-text-primary">Configuración</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Tu plan, método de pago e historial de facturas.
      </p>

      {estaEnInconsistencia && (
        <div className="mt-4">
          <Alert tone="info" title="Plan Pro sin pago registrado">
            Elegiste Pro al crear tu cuenta, antes de que el cobro real
            existiera — por ahora sigue activo sin que se te haya cobrado
            nada. Cuando el pago esté conectado te vamos a pedir confirmarlo.
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
                  <> — pasa a {ETIQUETA_PLAN[suscripcion.planAlRenovar]} el{" "}
                    {suscripcion.finPeriodoActual?.toLocaleDateString("es-VE") ?? "fin del periodo"}
                  </>
                )}
              </p>
            </div>

            {suscripcion.planActual === "FICHA" ? (
              elegiblePro ? (
                <CambiarPlanBoton plan="PRO" etiqueta="Subir a Pro" />
              ) : (
                <span className="text-caption text-text-faint">
                  Pro no disponible para tu profesión todavía
                </span>
              )
            ) : (
              !suscripcion.planAlRenovar && (
                <CambiarPlanBoton plan="FICHA" etiqueta="Bajar a Ficha" variant="secondary" />
              )
            )}
          </div>
        </Card>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">Pago</h2>
        <div className="mt-3">
          <Card padding="spacious">
            {suscripcion.metodoPagoResumen ? (
              <p className="text-body-secondary text-text-primary">
                {suscripcion.metodoPagoResumen}
              </p>
            ) : (
              <p className="text-body-secondary text-text-secondary">
                Todavía no agregaste un método de pago.
              </p>
            )}
            <div className="mt-3">
              <CambiarPlanBoton
                plan={suscripcion.planActual}
                etiqueta={suscripcion.metodoPagoResumen ? "Actualizar método de pago" : "Agregar método de pago"}
                variant="secondary"
              />
            </div>
          </Card>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-text-primary">Facturas</h2>
        <div className="mt-3">
          {pagos.length === 0 ? (
            <p className="text-body-secondary text-text-faint">
              Todavía no hay cobros registrados.
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
                        <p className="text-caption text-text-faint">{pago.estado}</p>
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

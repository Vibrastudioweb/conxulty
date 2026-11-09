import { requireSuperadmin } from "@/modules/core/autorizacion";
import { listarPagosPendientes } from "@/modules/suscripcion/pagoManual";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { confirmarPagoAction, rechazarPagoAction } from "./actions";

export const metadata = { title: "Pagos pendientes — CONXULTY" };

const ETIQUETA_PLAN: Record<"FICHA" | "PRO", string> = {
  FICHA: "Ficha",
  PRO: "Pro",
};

/**
 * Cuenta personal en SPIDI, sin API ni webhook (changelog punto 89): esta
 * pantalla ES la confirmación de pago — se revisa el comprobante que el
 * médico mandó por WhatsApp contra lo que diga mispidi.com/consulta, y se
 * confirma o rechaza acá a mano.
 */
export default async function PagosPendientesPage() {
  await requireSuperadmin();
  const pagos = await listarPagosPendientes();

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-6">
      <PageHeader
        eyebrow="Súper-admin"
        title="Pagos pendientes"
        description="Confirma contra el comprobante que te mandaron por WhatsApp y lo que diga mispidi.com/consulta."
      />

      {pagos.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="No hay pagos esperando confirmación." />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {pagos.map((p) => (
            <li key={p.id}>
              <Card>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text-primary">
                      {p.nombreOrganizacion}
                    </p>
                    <p className="text-body-secondary text-text-secondary">
                      {p.medicoNombre ?? "—"}
                      {p.medicoEmail ? ` · ${p.medicoEmail}` : ""}
                    </p>
                    <p className="text-caption text-text-faint">
                      {p.fecha.toLocaleString("es", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  </div>
                  <p className="font-semibold text-text-primary">
                    ${(p.montoCentavos / 100).toFixed(0)} · Plan {ETIQUETA_PLAN[p.plan]}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={confirmarPagoAction}>
                    <input type="hidden" name="pagoId" value={p.id} />
                    <Button type="submit" size="sm">
                      Confirmar pago
                    </Button>
                  </form>
                  <form action={rechazarPagoAction}>
                    <input type="hidden" name="pagoId" value={p.id} />
                    <Button type="submit" size="sm" variant="ghost">
                      Rechazar
                    </Button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

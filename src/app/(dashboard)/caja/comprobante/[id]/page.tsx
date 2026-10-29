import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSesion } from "@/modules/core/autorizacion";
import { prisma } from "@/db/client";
import {
  obtenerComprobante,
  formatearTelefonoWhatsApp,
  construirLinkWhatsApp,
  construirMensajeWhatsApp,
} from "@/modules/cobros-caja/comprobantes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";

/**
 * Pantalla de confirmación tras registrar un cobro (ver changelog punto
 * 13/48). Es una vista, no un documento descargable/imprimible — decisión
 * explícita del usuario (vista en pantalla, no PDF), con un botón que abre
 * WhatsApp (link `wa.me`, sin proveedor/API — se manda desde el WhatsApp
 * real de quien está atendiendo caja) con el comprobante y, si la consulta
 * de origen tiene receta(s), el detalle de medicamentos también.
 */
export default async function ComprobantePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSesion();
  const { id } = await params;

  const comprobante = await obtenerComprobante({
    organizacionId: session.user.organizacionId,
    cobroId: id,
  });

  if (!comprobante) {
    notFound();
  }

  const organizacion = await prisma.organizacion.findUnique({
    where: { id: session.user.organizacionId },
    select: { nombre: true },
  });

  const simbolo = comprobante.moneda === "USD" ? "$" : "Bs";
  const hayDescuento = Number(comprobante.descuentoMonto) > 0;

  const telefonoWa = formatearTelefonoWhatsApp(comprobante.paciente?.telefono);
  const mensajeWa = construirMensajeWhatsApp(comprobante, organizacion?.nombre ?? "CONXULTY");
  const linkWa = telefonoWa ? construirLinkWhatsApp(telefonoWa, mensajeWa) : null;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-lg lg:py-12">
      <PageHeader title={`Comprobante ${comprobante.folio}`} />

      <Card padding="spacious" className="mt-4">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-faint">Fecha</dt>
            <dd className="text-text-primary">{comprobante.fecha.toLocaleString("es")}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-faint">Método de pago</dt>
            <dd className="text-text-primary">{comprobante.metodoPagoLabel}</dd>
          </div>
          {comprobante.paciente && (
            <div className="flex justify-between">
              <dt className="text-text-faint">Paciente</dt>
              <dd className="text-text-primary">
                {comprobante.paciente.nombre} {comprobante.paciente.apellido}
              </dd>
            </div>
          )}
          {comprobante.concepto && (
            <div className="flex justify-between">
              <dt className="text-text-faint">Concepto</dt>
              <dd className="text-text-primary">{comprobante.concepto}</dd>
            </div>
          )}
        </dl>

        <div className="mt-4 space-y-1 border-t border-border pt-3 text-sm">
          {hayDescuento && (
            <>
              <div className="flex justify-between text-text-secondary">
                <span>Subtotal</span>
                <span>
                  {simbolo}
                  {comprobante.subtotal}
                </span>
              </div>
              <div className="flex justify-between text-danger-text">
                <span>Descuento ({comprobante.descuentoMotivo})</span>
                <span>
                  -{simbolo}
                  {comprobante.descuentoMonto}
                </span>
              </div>
            </>
          )}
          <div className="flex justify-between text-base font-semibold text-text-primary">
            <span>Total cobrado</span>
            <span>
              {simbolo}
              {comprobante.total}
            </span>
          </div>
        </div>

        {comprobante.recetas.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <h2 className="text-sm font-semibold text-text-primary">Receta médica</h2>
            {comprobante.recetas.map((receta, i) => (
              <ul key={i} className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
                {receta.medicamentos.map((med, j) => (
                  <li key={j}>
                    {med.nombre} — {med.indicaciones}
                  </li>
                ))}
                {receta.indicacionesGenerales && (
                  <li className="list-none pl-0 text-text-faint">
                    Indicaciones: {receta.indicacionesGenerales}
                  </li>
                )}
              </ul>
            ))}
          </div>
        )}
      </Card>

      <div className="mt-5 space-y-3">
        {linkWa ? (
          <a
            href={linkWa}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center rounded-button bg-success px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
          >
            Enviar por WhatsApp al paciente
          </a>
        ) : (
          <Alert tone="warning">
            El paciente no tiene un teléfono válido registrado — no se puede armar el enlace de
            WhatsApp.
          </Alert>
        )}

        <Link
          href="/caja"
          className="flex w-full items-center justify-center rounded-button border border-border px-4 py-2.5 text-sm font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary"
        >
          Volver a Caja
        </Link>
      </div>
    </main>
  );
}

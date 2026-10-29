import Link from "next/link";
import { requireSesion } from "@/modules/core/autorizacion";
import { obtenerResumenFinanciero } from "@/modules/reportes/reportes";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ResumenFinancieroCard } from "@/components/reportes/ResumenFinancieroCard";
import {
  SelectorVistaReporte,
  type VistaReporte,
} from "@/components/reportes/SelectorVistaReporte";
import {
  fechaDesdeParam,
  formatearFechaISO,
  sumarDias,
  inicioSemana,
  inicioMes,
} from "@/components/citas/fecha";

/**
 * Reporte financiero por período (29-oct-2026 — ver changelog punto
 * 17/44). Independiente de Caja: agrega `Cobro`/`Gasto` reales por rango
 * de fecha, sin que importe si hubo una caja abierta, cerrada, o ninguna
 * en el medio — ver `obtenerResumenFinanciero`.
 */
export default async function ReportesPage({
  searchParams,
}: {
  searchParams: Promise<{
    vista?: string;
    fecha?: string;
    desde?: string;
    hasta?: string;
  }>;
}) {
  const session = await requireSesion();
  const { vista: vistaParam, fecha: fechaParam, desde, hasta } = await searchParams;

  const vista: VistaReporte =
    vistaParam === "dia" || vistaParam === "mes" || vistaParam === "rango"
      ? vistaParam
      : "semana";
  const fecha = fechaDesdeParam(fechaParam);
  const fechaISO = formatearFechaISO(fecha);

  let inicio: Date;
  let fin: Date;
  let etiquetaRango: string;
  let anteriorHref: string | null = null;
  let siguienteHref: string | null = null;

  if (vista === "dia") {
    inicio = new Date(fecha);
    inicio.setHours(0, 0, 0, 0);
    fin = sumarDias(inicio, 1);
    etiquetaRango = fecha.toLocaleDateString("es", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    anteriorHref = `/reportes?vista=dia&fecha=${formatearFechaISO(sumarDias(fecha, -1))}`;
    siguienteHref = `/reportes?vista=dia&fecha=${formatearFechaISO(sumarDias(fecha, 1))}`;
  } else if (vista === "mes") {
    inicio = inicioMes(fecha);
    fin = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    etiquetaRango = fecha.toLocaleDateString("es", { month: "long", year: "numeric" });
    const mesAnterior = new Date(inicio.getFullYear(), inicio.getMonth() - 1, 1);
    const mesSiguiente = new Date(inicio.getFullYear(), inicio.getMonth() + 1, 1);
    anteriorHref = `/reportes?vista=mes&fecha=${formatearFechaISO(mesAnterior)}`;
    siguienteHref = `/reportes?vista=mes&fecha=${formatearFechaISO(mesSiguiente)}`;
  } else if (vista === "rango") {
    const desdeFecha = fechaDesdeParam(desde || formatearFechaISO(sumarDias(new Date(), -6)));
    const hastaFecha = fechaDesdeParam(hasta || formatearFechaISO(new Date()));
    inicio = new Date(desdeFecha);
    inicio.setHours(0, 0, 0, 0);
    fin = sumarDias(hastaFecha, 1);
    etiquetaRango = `${desdeFecha.toLocaleDateString("es", { day: "numeric", month: "short" })} – ${hastaFecha.toLocaleDateString("es", { day: "numeric", month: "short" })}`;
  } else {
    // semana
    inicio = inicioSemana(fecha);
    fin = sumarDias(inicio, 7);
    etiquetaRango = `${inicio.toLocaleDateString("es", { day: "numeric", month: "short" })} – ${sumarDias(inicio, 6).toLocaleDateString("es", { day: "numeric", month: "short" })}`;
    anteriorHref = `/reportes?vista=semana&fecha=${formatearFechaISO(sumarDias(fecha, -7))}`;
    siguienteHref = `/reportes?vista=semana&fecha=${formatearFechaISO(sumarDias(fecha, 7))}`;
  }

  const resumen = await obtenerResumenFinanciero({
    organizacionId: session.user.organizacionId,
    inicio,
    fin,
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader title="Reportes" description="Ingresos, gastos y ganancia por período." />

      <div className="mt-4">
        <SelectorVistaReporte vistaActual={vista} fechaISO={fechaISO} />
      </div>

      {vista === "rango" ? (
        <form className="mt-6 flex flex-wrap items-end gap-3" action="/reportes">
          <input type="hidden" name="vista" value="rango" />
          <div>
            <label htmlFor="desde" className="mb-1 block text-caption text-text-secondary">
              Desde
            </label>
            <Input
              id="desde"
              name="desde"
              type="date"
              defaultValue={desde || formatearFechaISO(sumarDias(new Date(), -6))}
            />
          </div>
          <div>
            <label htmlFor="hasta" className="mb-1 block text-caption text-text-secondary">
              Hasta
            </label>
            <Input
              id="hasta"
              name="hasta"
              type="date"
              defaultValue={hasta || formatearFechaISO(new Date())}
            />
          </div>
          <Button type="submit" variant="secondary">
            Ver rango
          </Button>
        </form>
      ) : (
        <div className="mt-6 flex items-center justify-between gap-2">
          <Link
            href={anteriorHref!}
            className="rounded-button border border-border px-3 py-1.5 text-body-secondary text-text-secondary hover:border-brand-primary"
          >
            ← Anterior
          </Link>
          <p className="text-body-secondary font-medium capitalize text-text-primary">
            {etiquetaRango}
          </p>
          <Link
            href={siguienteHref!}
            className="rounded-button border border-border px-3 py-1.5 text-body-secondary text-text-secondary hover:border-brand-primary"
          >
            Siguiente →
          </Link>
        </div>
      )}

      {vista === "rango" && (
        <p className="mt-3 text-caption capitalize text-text-faint">{etiquetaRango}</p>
      )}

      <section className="mt-6 space-y-3">
        {resumen.length === 0 ? (
          <EmptyState message="Sin cobros ni gastos registrados en este período." />
        ) : (
          resumen.map((r) => <ResumenFinancieroCard key={r.moneda} resumen={r} />)
        )}
      </section>
    </main>
  );
}

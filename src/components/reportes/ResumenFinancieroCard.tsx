import { Card } from "@/components/ui/Card";
import type { ResumenMoneda } from "@/modules/reportes/reportes";

function formatearMonto(valor: number, moneda: string): string {
  const simbolo = moneda === "USD" ? "$" : `${moneda} `;
  return `${simbolo}${valor.toLocaleString("es", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Una tarjeta por moneda — nunca una sola tarjeta sumando monedas distintas
 * (ver nota de `obtenerResumenFinanciero` sobre por qué eso sería
 * incorrecto). La ganancia se resalta en verde/rojo según el signo; 0 no es
 * "pérdida", es neutral.
 */
export function ResumenFinancieroCard({ resumen }: { resumen: ResumenMoneda }) {
  const colorGanancia =
    resumen.ganancia > 0
      ? "text-success-text"
      : resumen.ganancia < 0
        ? "text-danger-text"
        : "text-text-primary";

  return (
    <Card padding="compact">
      <p className="text-eyebrow font-semibold uppercase tracking-wide text-text-faint">
        {resumen.moneda}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-3">
        <div>
          <dt className="text-caption text-text-faint">Ingresos</dt>
          <dd className="mt-0.5 text-card-title font-semibold text-text-primary">
            {formatearMonto(resumen.ingresos, resumen.moneda)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-text-faint">Gastos</dt>
          <dd className="mt-0.5 text-card-title font-semibold text-text-primary">
            {formatearMonto(resumen.gastos, resumen.moneda)}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-text-faint">Ganancia</dt>
          <dd className={`mt-0.5 text-card-title font-semibold ${colorGanancia}`}>
            {formatearMonto(resumen.ganancia, resumen.moneda)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}

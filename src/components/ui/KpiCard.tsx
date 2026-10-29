import type { LucideIcon } from "lucide-react";

/**
 * Tarjeta de métrica del dashboard de "Hoy" (29-oct-2026, rediseño llevado
 * de la demo — ver changelog del proyecto, punto 2 y 43).
 *
 * A diferencia de la demo, que mostraba 4 KPIs con deltas "vs. ayer" de
 * relleno: aquí solo se muestran métricas que de verdad se calculan contra
 * datos reales (ver hoy/page.tsx). No hay "Pendientes clínicos" — ese
 * concepto no existe en el modelo real y no se inventó uno — y no hay
 * comparación "vs. ayer" porque no hay ningún histórico agregado por día
 * todavía (mismo HECHO ya anotado en el changelog, punto 17, sobre
 * Reportes).
 */
export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3.5">
      <div className="flex items-center gap-2 text-text-faint">
        <Icon size={15} aria-hidden="true" />
        <span className="text-eyebrow font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="mt-2 font-display text-page-title font-semibold text-text-primary">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-caption text-text-faint">{hint}</p>
      )}
    </div>
  );
}

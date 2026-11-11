import Link from "next/link";
import type { LucideIcon } from "lucide-react";

/**
 * Tarjeta de métrica del dashboard de "Hoy" (29-oct-2026, rediseño llevado
 * de la demo — ver changelog del proyecto, punto 2 y 43; chip de color +
 * delta "vs. ayer" agregados 08-nov-2026, punto 54).
 *
 * A diferencia de la demo original, que mostraba deltas de relleno: el
 * delta de aquí SÍ se calcula contra datos reales de ayer (ver
 * hoy/page.tsx) — no es decorativo. Sigue sin existir "Pendientes
 * clínicos" (no hay ese concepto en el modelo real, ver punto 2).
 */
export type KpiAccent = "indigo" | "green" | "amber" | "sky";

const ACCENT_BG: Record<KpiAccent, string> = {
  indigo: "bg-brand-primary-soft",
  green: "bg-success-soft",
  amber: "bg-warning-soft",
  sky: "bg-info-soft",
};

const ACCENT_TEXT: Record<KpiAccent, string> = {
  indigo: "text-brand-primary",
  green: "text-success-text",
  amber: "text-warning-text",
  sky: "text-info-text",
};

export interface KpiDelta {
  direccion: "up" | "down" | "flat";
  texto: string;
}

const DELTA_TEXT: Record<KpiDelta["direccion"], string> = {
  up: "text-success-text",
  down: "text-danger-text",
  flat: "text-text-faint",
};

const DELTA_PREFIJO: Record<KpiDelta["direccion"], string> = {
  up: "↑",
  down: "↓",
  flat: "",
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  accent = "indigo",
  delta,
  href,
  dense = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  accent?: KpiAccent;
  delta?: KpiDelta;
  /** Si se pasa, toda la tarjeta es clickeable (ver changelog: el usuario
   *  pidió que ninguna tarjeta del panel quede sin llevar a algún lado). */
  href?: string;
  /** Variante compacta (10-nov-2026, panel lateral de /hoy): icono chico +
   *  valor + label apilados pero con menos padding/alto que la versión
   *  normal, para que un grid 2x2 de estas tarjetas ocupe mucho menos alto
   *  — el objetivo es que /hoy entre en una sola pantalla sin scroll
   *  ("Scroll vertical de más", pedido del usuario). Apilado (no en fila)
   *  a propósito: en una columna angosta (panel lateral, grid de 2) una
   *  fila icono+texto deja muy poco ancho para el label y lo trunca a una
   *  letra — probado en vivo, ver changelog. El delta/hint se omite acá:
   *  en este resumen puntual, el valor y el label ya alcanzan. */
  dense?: boolean;
}) {
  if (dense) {
    const contenidoDenso = (
      <div>
        <span
          className={`inline-flex h-6 w-6 items-center justify-center rounded-input ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
        >
          <Icon size={13} aria-hidden="true" />
        </span>
        <p className="mt-1.5 font-display text-section-title font-semibold leading-tight text-text-primary">
          {value}
        </p>
        <p className="mt-0.5 text-caption leading-snug text-text-faint">{label}</p>
      </div>
    );

    if (href) {
      return (
        <Link
          href={href}
          className="block rounded-card border border-border bg-surface px-3 py-2 transition hover:border-brand-primary"
        >
          {contenidoDenso}
        </Link>
      );
    }

    return (
      <div className="rounded-card border border-border bg-surface px-3 py-2">
        {contenidoDenso}
      </div>
    );
  }

  const contenido = (
    <>
      <span
        className={`inline-flex h-8 w-8 items-center justify-center rounded-input ${ACCENT_BG[accent]} ${ACCENT_TEXT[accent]}`}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <p className="mt-3 font-display text-page-title font-semibold text-text-primary">
        {value}
      </p>
      <p className="mt-0.5 text-caption text-text-faint">{label}</p>
      {delta ? (
        <p className={`mt-1.5 text-caption font-medium ${DELTA_TEXT[delta.direccion]}`}>
          {DELTA_PREFIJO[delta.direccion]} {delta.texto}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-caption text-text-faint">{hint}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-card border border-border bg-surface px-4 py-3.5 transition hover:border-brand-primary"
      >
        {contenido}
      </Link>
    );
  }

  return (
    <div className="rounded-card border border-border bg-surface px-4 py-3.5">
      {contenido}
    </div>
  );
}

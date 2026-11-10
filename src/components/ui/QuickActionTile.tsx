import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

/**
 * Acceso rápido de navegación, en tarjeta de color (ver changelog punto
 * 54) — reemplaza el botón de texto plano `QuickAction` solo en /hoy, que
 * era el único lugar que lo usaba. Es un `Link`, no un botón de acción:
 * navega, no ejecuta un formulario.
 *
 * Fondo sólido (10-nov-2026, "colores mas solidos y llamativos aca") —
 * reemplaza el tinte suave *-soft, que en la fila de 3 tarjetas se veía
 * apagado/casi sin color. Con fondo sólido, icono/título/subtítulo pasan a
 * blanco (o casi) para mantener contraste; la flecha baja de opacidad en
 * vez de usar text-faint, que no se lee sobre un fondo de marca.
 */
export type QuickActionAccent = "indigo" | "green" | "amber" | "sky";

const ACCENT_BG: Record<QuickActionAccent, string> = {
  indigo: "bg-brand-primary",
  green: "bg-success",
  amber: "bg-warning",
  sky: "bg-info",
};

export function QuickActionTile({
  href,
  icon: Icon,
  title,
  subtitle,
  accent = "indigo",
}: {
  href: string;
  icon: LucideIcon;
  title: string;
  subtitle: string;
  accent?: QuickActionAccent;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start justify-between gap-2 rounded-card px-4 py-3.5 text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-primary ${ACCENT_BG[accent]}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className="mt-0.5 shrink-0 text-white" aria-hidden="true" />
        <div>
          <p className="text-body-secondary font-semibold text-white">{title}</p>
          <p className="mt-0.5 text-caption text-white/80">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={16} className="mt-1 shrink-0 text-white/70" aria-hidden="true" />
    </Link>
  );
}

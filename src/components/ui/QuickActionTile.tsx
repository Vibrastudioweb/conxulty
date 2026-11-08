import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";

/**
 * Acceso rápido de navegación, en tarjeta de color (ver changelog punto
 * 54) — reemplaza el botón de texto plano `QuickAction` solo en /hoy, que
 * era el único lugar que lo usaba. Es un `Link`, no un botón de acción:
 * navega, no ejecuta un formulario.
 */
export type QuickActionAccent = "indigo" | "green" | "amber" | "sky";

const ACCENT_BG: Record<QuickActionAccent, string> = {
  indigo: "bg-brand-primary-soft",
  green: "bg-success-soft",
  amber: "bg-warning-soft",
  sky: "bg-info-soft",
};

const ACCENT_TEXT: Record<QuickActionAccent, string> = {
  indigo: "text-brand-primary",
  green: "text-success-text",
  amber: "text-warning-text",
  sky: "text-info-text",
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
      className={`flex items-start justify-between gap-2 rounded-card px-4 py-3.5 transition hover:brightness-[0.97] focus:outline-none focus:ring-2 focus:ring-brand-primary ${ACCENT_BG[accent]}`}
    >
      <div className="flex items-start gap-3">
        <Icon size={18} className={`mt-0.5 shrink-0 ${ACCENT_TEXT[accent]}`} aria-hidden="true" />
        <div>
          <p className="text-body-secondary font-semibold text-text-primary">{title}</p>
          <p className="mt-0.5 text-caption text-text-secondary">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={16} className="mt-1 shrink-0 text-text-faint" aria-hidden="true" />
    </Link>
  );
}

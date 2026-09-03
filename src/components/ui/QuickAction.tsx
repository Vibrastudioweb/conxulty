import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export type QuickActionVariant = "primary" | "secondary";

// Mismas clases que Button (primary/secondary) para que un acceso rápido de
// navegación se sienta como el mismo lenguaje visual que los botones de
// acción del resto de la app, sin duplicar un botón "gigante".
const VARIANT_CLASSES: Record<QuickActionVariant, string> = {
  primary: "bg-brand-primary text-white hover:bg-brand-primary-hover",
  secondary:
    "border border-brand-primary text-brand-primary hover:bg-brand-primary-soft",
};

/**
 * Acceso rápido de navegación (icono + etiqueta) — p.ej. "Ver agenda" /
 * "Nueva consulta sin cita" en /hoy. Es un `Link`, no un `Button`: navega,
 * no ejecuta una acción de formulario.
 */
export function QuickAction({
  href,
  icon: Icon,
  label,
  variant = "secondary",
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  variant?: QuickActionVariant;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-button px-4 py-2.5 text-body-secondary font-semibold transition focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2 ${VARIANT_CLASSES[variant]}`}
    >
      <Icon size={17} className="shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}

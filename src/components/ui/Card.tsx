import Link from "next/link";
import type { ReactNode } from "react";

type CardPadding = "cozy" | "compact" | "spacious";

const PADDING_CLASSES: Record<CardPadding, string> = {
  cozy: "px-3 py-2",
  compact: "px-4 py-3",
  spacious: "p-8",
};

interface CardOwnProps {
  children: ReactNode;
  className?: string;
  padding?: CardPadding;
  /** Borde de acento — p.ej. la tarjeta de la próxima cita en /hoy. */
  highlighted?: boolean;
  /** Sombra — p.ej. la tarjeta contenedora del formulario de login. */
  elevated?: boolean;
}

type CardProps =
  | (CardOwnProps & { href?: undefined; onClick?: undefined })
  | (CardOwnProps & { href: string; onClick?: undefined })
  | (CardOwnProps & { href?: undefined; onClick: () => void });

export function Card({
  children,
  className = "",
  padding = "compact",
  highlighted = false,
  elevated = false,
  href,
  onClick,
}: CardProps) {
  const esInteractiva = Boolean(href) || Boolean(onClick);
  const classes = [
    "rounded-card border bg-surface text-sm",
    PADDING_CLASSES[padding],
    highlighted ? "border-brand-primary" : "border-border",
    elevated ? "shadow-card" : "",
    esInteractiva
      ? "block w-full text-left transition hover:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary focus:ring-offset-2"
      : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  // onClick (sin href): tarjeta como botón — p.ej. abrir el panel de
  // "Detalle de la cita" (ver changelog punto 60) en vez de navegar.
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={classes}>
        {children}
      </button>
    );
  }

  return <div className={classes}>{children}</div>;
}

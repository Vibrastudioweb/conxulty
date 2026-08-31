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
  | (CardOwnProps & { href?: undefined })
  | (CardOwnProps & { href: string });

export function Card({
  children,
  className = "",
  padding = "compact",
  highlighted = false,
  elevated = false,
  href,
}: CardProps) {
  const classes = [
    "rounded-card border bg-surface text-sm",
    PADDING_CLASSES[padding],
    highlighted ? "border-brand-primary" : "border-border",
    elevated ? "shadow-card" : "",
    href ? "block transition hover:border-brand-primary" : "",
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

  return <div className={classes}>{children}</div>;
}

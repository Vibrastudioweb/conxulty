import { Loader2 } from "lucide-react";

/**
 * Spinner inline genérico — para estados de carga puntuales que no
 * justifican un Skeleton (p.ej. dentro de un botón, ver Button `loading`).
 */
export function Spinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Loader2
      size={size}
      className={`animate-spin ${className}`}
      aria-hidden="true"
    />
  );
}

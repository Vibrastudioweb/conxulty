/**
 * Wordmark tipográfico PROVISIONAL de CONXULTY.
 *
 * El isotipo oficial (la "X" de dos cintas cruzadas en degradado azul→violeta)
 * todavía no existe como asset exportado dentro de public/ — ver
 * public/brand/README.md. Este componente es un sustituto de solo texto,
 * nunca una recreación del isotipo, y es el único lugar del código que debe
 * cambiar cuando el SVG oficial esté disponible.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className}`}>
      <span className="text-text-primary">conxu</span>
      <span
        className="bg-clip-text text-transparent"
        style={{ backgroundImage: "var(--gradient-brand)" }}
      >
        lty
      </span>
    </span>
  );
}

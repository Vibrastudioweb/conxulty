/**
 * Wordmark tipográfico PROVISIONAL de CONXULTY.
 *
 * El isotipo oficial (la "X" de dos cintas cruzadas en degradado azul→violeta)
 * todavía no existe como asset exportado dentro de public/ — ver
 * public/brand/README.md. Este componente es un sustituto de solo texto,
 * nunca una recreación del isotipo, y es uno de los dos únicos lugares del
 * código (junto con BrandMark.tsx) que deben cambiar cuando el SVG oficial
 * esté disponible. `Logo` combina Wordmark + BrandMark para el caso general
 * (Sidebar, MobileHeader); Wordmark solo se usa suelto donde el diseño pide
 * deliberadamente texto sin isotipo (hoy: Login). `BrandMark` (el "C") en
 * cambio no debe usarse suelto en ningún otro lugar — siempre vía `Logo`.
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

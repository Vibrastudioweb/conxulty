/**
 * Isotipo PROVISIONAL de CONXULTY: un monograma "C" sobre el degradado de
 * marca (Azul → Violeta), usado mientras no exista el isotipo oficial de
 * Figma (ver public/brand/README.md). Encapsulado a propósito — cuando el
 * SVG oficial llegue, este es uno de los dos únicos archivos (junto con
 * Wordmark.tsx) que deben cambiar; nada fuera de `Logo` debería depender de
 * su implementación interna.
 */
export function BrandMark({
  size = 32,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[10px] font-display font-bold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.52,
        backgroundImage: "var(--gradient-brand)",
      }}
    >
      C
    </span>
  );
}

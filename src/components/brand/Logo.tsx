import { BrandMark } from "./BrandMark";
import { Wordmark } from "./Wordmark";

type LogoSize = "sm" | "md" | "lg";

const MARK_SIZE: Record<LogoSize, number> = {
  sm: 24,
  md: 32,
  lg: 40,
};

const WORDMARK_TEXT_CLASSES: Record<LogoSize, string> = {
  sm: "text-body",
  md: "text-page-title",
  lg: "text-display",
};

/**
 * Punto único de composición de la identidad de CONXULTY. El resto de la
 * app debe usar `Logo`, no `BrandMark`/`Wordmark` por separado, para que
 * sustituir los assets provisionales (ver esos dos archivos) no implique
 * tocar cada pantalla que muestra la marca.
 */
export function Logo({
  size = "md",
  className = "",
}: {
  size?: LogoSize;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <BrandMark size={MARK_SIZE[size]} />
      <Wordmark className={WORDMARK_TEXT_CLASSES[size]} />
    </span>
  );
}

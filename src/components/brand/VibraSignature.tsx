/**
 * Firma discreta de VIBRA como creador del producto. Nunca debe competir
 * visualmente con la marca CONXULTY — por eso vive en tamaño caption/color
 * atenuado, y solo en superficies de marca puntuales (pie del AppShell,
 * Login), no repetida en cada pantalla.
 */
export function VibraSignature({ className = "" }: { className?: string }) {
  return (
    <p className={`text-caption text-text-faint ${className}`}>
      by <span className="font-semibold text-text-secondary">VIBRA</span>
    </p>
  );
}

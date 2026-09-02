import type { ReactNode } from "react";

export interface PageHeaderProps {
  /** Etiqueta corta sobre el título (p.ej. sección o categoría). */
  eyebrow?: string;
  title: string;
  description?: string;
  /** Acción principal de la pantalla (p.ej. "+ Nuevo paciente"). */
  action?: ReactNode;
  secondaryActions?: ReactNode;
  /** Slot para breadcrumb/back-link — reemplaza progresivamente los
   *  "← Volver a X" sueltos que cada pantalla escribía por su cuenta. */
  context?: ReactNode;
}

/**
 * Header estándar de página. Ya no asume Logout por defecto: esa
 * responsabilidad la tiene el AppShell (Sidebar en desktop, MobileHeader en
 * mobile), disponible en todas las pantallas del dashboard sin que cada una
 * tenga que pedirlo explícitamente.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  action,
  secondaryActions,
  context,
}: PageHeaderProps) {
  return (
    <div className="space-y-2">
      {context}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-eyebrow font-semibold uppercase tracking-wide text-text-faint">
              {eyebrow}
            </p>
          )}
          <h1 className="font-display text-page-title font-semibold text-text-primary">
            {title}
          </h1>
          {description && (
            <p className="mt-1 text-body-secondary text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {(action || secondaryActions) && (
          <div className="flex items-center gap-2">
            {secondaryActions}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}

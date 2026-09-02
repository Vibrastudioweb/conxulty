import { NavList } from "./NavList";
import type { NavItem } from "./nav-config";

/**
 * Tab bar inferior de mobile — solo secciones `primary` (Hoy/Agenda/
 * Pacientes hoy). Acciones secundarias siguen viviendo dentro de cada
 * pantalla (esta fase no toca esos flujos), a propósito no se satura el
 * tab bar con más de 3-4 destinos.
 */
export function BottomNav({
  items,
  className = "",
}: {
  items: NavItem[];
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <nav
      aria-label="Navegación principal"
      className={`fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface/95 backdrop-blur print:hidden ${className}`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <NavList items={items} variant="bottom" />
    </nav>
  );
}

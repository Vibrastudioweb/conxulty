import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { navForRol } from "@/components/navigation/nav-config";
import { BottomNav } from "@/components/navigation/BottomNav";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";

/**
 * Estructura persistente del dashboard: sidebar + contenido en desktop
 * (lg+), header compacto + tab bar inferior en mobile. Sustituye el
 * `max-w-md` universal que antes centraba cada pantalla por sí sola — las
 * páginas siguen definiendo su propio ancho de contenido (no se toca en
 * esta fase), pero ahora corren dentro de un frame consciente del viewport
 * en vez de estar solas en la pantalla.
 *
 * Server Component: la única parte interactiva (resaltar la sección activa)
 * vive en NavList, no aquí.
 */
export function AppShell({
  user,
  children,
}: {
  user: Session["user"];
  children: ReactNode;
}) {
  const items = navForRol(user.rol);
  const primaryItems = items.filter((item) => item.primary);

  return (
    <div className="min-h-screen bg-background lg:flex">
      <Sidebar items={items} user={user} className="hidden lg:flex" />

      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader className="lg:hidden" />
        <main className="flex-1 pb-20 lg:pb-0 print:pb-0">{children}</main>
      </div>

      <BottomNav items={primaryItems} className="lg:hidden" />
    </div>
  );
}

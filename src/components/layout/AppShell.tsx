import type { Session } from "next-auth";
import type { ReactNode } from "react";
import { navForRol } from "@/components/navigation/nav-config";
import { BottomNav } from "@/components/navigation/BottomNav";
import { obtenerAlertasTopbar } from "@/modules/core/notificaciones";
import { Sidebar } from "./Sidebar";
import { MobileHeader } from "./MobileHeader";
import { Topbar } from "./Topbar";

/**
 * Estructura persistente del dashboard: sidebar + contenido en desktop
 * (lg+), header compacto + tab bar inferior en mobile. Sustituye el
 * `max-w-md` universal que antes centraba cada pantalla por sí sola — las
 * páginas siguen definiendo su propio ancho de contenido (no se toca en
 * esta fase), pero ahora corren dentro de un frame consciente del viewport
 * en vez de estar solas en la pantalla.
 *
 * Async desde el 29-oct-2026: carga las alertas reales de notificaciones
 * una sola vez aquí (con el `organizacionId` de la sesión) y las reparte a
 * `Topbar` (desktop) y `MobileHeader` (mobile) — ver
 * `obtenerAlertasTopbar` sobre por qué el alcance es por organización, no
 * por médico, para que ADMIN/STAFF/MEDICO vean lo mismo.
 *
 * Server Component: las únicas partes interactivas (resaltar la sección
 * activa, el menú de notificaciones) viven en NavList y
 * NotificacionesBell, no aquí.
 */
export async function AppShell({
  user,
  children,
}: {
  user: Session["user"];
  children: ReactNode;
}) {
  const items = navForRol(user.rol);
  const primaryItems = items.filter((item) => item.primary);
  const alertas = await obtenerAlertasTopbar({
    organizacionId: user.organizacionId,
  });

  return (
    <div className="min-h-screen bg-background lg:flex">
      <Sidebar items={items} user={user} className="hidden lg:flex" />

      <div className="flex min-h-screen flex-1 flex-col">
        <MobileHeader alertas={alertas} className="lg:hidden" />
        <Topbar alertas={alertas} className="hidden lg:flex" />
        {/* No es <main>: cada página ya renderiza su propio <main> — anidar
            landmarks "main" es inválido en HTML y duplica el landmark para
            lectores de pantalla. */}
        <div className="flex-1 pb-20 lg:pb-0 print:pb-0">{children}</div>
      </div>

      <BottomNav items={primaryItems} className="lg:hidden" />
    </div>
  );
}

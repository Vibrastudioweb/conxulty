import Link from "next/link";
import type { Session } from "next-auth";
import { Logo } from "@/components/brand/Logo";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { SupportButton } from "@/components/ui/SupportButton";
import { AjustesButton } from "@/components/ui/AjustesButton";
import { NavList } from "@/components/navigation/NavList";
import type { NavItem } from "@/components/navigation/nav-config";

/**
 * Navegación persistente de escritorio (lg+). Server Component: solo
 * `NavList` adentro es cliente (necesita la ruta activa). El ancho,
 * padding y botón de retraer/expandir viven en `SidebarFrame` (cliente) —
 * este componente es su `children`, así que las clases de acá que
 * reaccionan al colapso lo hacen solo con CSS
 * (`group-data-[collapsed=true]/sidebar:...`), sin necesitar su propio
 * estado de cliente.
 */
export function Sidebar({
  items,
  user,
}: {
  items: NavItem[];
  user: Session["user"];
}) {
  return (
    <>
      <Link href="/" className="block px-2">
        <Logo
          size="md"
          wordmarkClassName="group-data-[collapsed=true]/sidebar:hidden"
        />
      </Link>

      <nav aria-label="Navegación principal" className="mt-10 flex-1">
        <NavList items={items} variant="sidebar" />
      </nav>

      <div className="border-t border-border pt-4">
        <div className="group-data-[collapsed=true]/sidebar:hidden">
          <p className="truncate px-2 text-body font-medium text-text-primary">
            {user.name}
          </p>
          <p className="truncate px-2 text-caption text-text-faint">{user.email}</p>
        </div>
        <div className="mt-2 flex items-center gap-3 px-2 group-data-[collapsed=true]/sidebar:flex-col group-data-[collapsed=true]/sidebar:gap-2 group-data-[collapsed=true]/sidebar:px-0">
          {user.rol === "MEDICO" && <AjustesButton />}
          <SupportButton />
          <LogoutButton />
        </div>
        <div className="mt-4 px-2 group-data-[collapsed=true]/sidebar:hidden">
          <VibraSignature />
        </div>
      </div>
    </>
  );
}

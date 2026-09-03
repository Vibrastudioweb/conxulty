import Link from "next/link";
import type { Session } from "next-auth";
import { Logo } from "@/components/brand/Logo";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { LogoutButton } from "@/components/ui/LogoutButton";
import { NavList } from "@/components/navigation/NavList";
import type { NavItem } from "@/components/navigation/nav-config";

/**
 * Navegación persistente de escritorio (lg+). Server Component: solo
 * `NavList` adentro es cliente (necesita la ruta activa).
 */
export function Sidebar({
  items,
  user,
  className = "",
}: {
  items: NavItem[];
  user: Session["user"];
  className?: string;
}) {
  return (
    <aside
      className={`w-80 shrink-0 flex-col border-r border-border bg-surface px-6 py-8 print:hidden ${className}`}
    >
      <Link href="/" className="block px-2">
        <Logo size="md" />
      </Link>

      <nav aria-label="Navegación principal" className="mt-10 flex-1">
        <NavList items={items} variant="sidebar" />
      </nav>

      <div className="border-t border-border pt-4">
        <p className="truncate px-2 text-body font-medium text-text-primary">
          {user.name}
        </p>
        <p className="truncate px-2 text-caption text-text-faint">{user.email}</p>
        <div className="mt-2 px-2">
          <LogoutButton />
        </div>
        <div className="mt-4 px-2">
          <VibraSignature />
        </div>
      </div>
    </aside>
  );
}

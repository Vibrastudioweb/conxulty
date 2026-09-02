import Link from "next/link";
import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/components/ui/LogoutButton";

/**
 * Header compacto de mobile (oculto en lg+, donde su lugar lo ocupa
 * Sidebar). Sticky para que la marca y la salida de sesión sigan
 * accesibles al hacer scroll dentro de una pantalla larga.
 */
export function MobileHeader({ className = "" }: { className?: string }) {
  return (
    <header
      className={`sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/95 px-4 py-3 backdrop-blur print:hidden ${className}`}
    >
      <Link href="/">
        <Logo size="sm" />
      </Link>
      <LogoutButton />
    </header>
  );
}

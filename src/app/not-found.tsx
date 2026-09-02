import Link from "next/link";
import { SearchX } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

/**
 * 404 raíz — cubre URLs que no coinciden con ninguna ruta de la app
 * (fuera del grupo (dashboard), así que no hay sesión garantizada ni
 * AppShell disponible aquí).
 */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Logo size="md" />

      <div className="flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-soft text-text-faint">
          <SearchX size={24} aria-hidden="true" />
        </span>
        <h1 className="font-display text-page-title font-semibold text-text-primary">
          Página no encontrada
        </h1>
        <p className="max-w-sm text-body-secondary text-text-secondary">
          La dirección a la que intentaste acceder no existe.
        </p>
      </div>

      <Link
        href="/"
        className="inline-flex items-center rounded-button bg-brand-primary px-4 py-2 text-body-secondary font-semibold text-white transition hover:bg-brand-primary-hover"
      >
        Ir al inicio
      </Link>
    </main>
  );
}

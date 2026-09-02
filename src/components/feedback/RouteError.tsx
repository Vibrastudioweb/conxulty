"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";

/**
 * Implementación compartida de error.tsx — Next.js exige que cada
 * error.tsx sea su propio Client Component con `export default`, así que
 * app/error.tsx y app/(dashboard)/error.tsx re-exportan este mismo
 * componente en vez de duplicar el markup. Nunca muestra `error.message`:
 * en Server Components ya llega genérico por diseño de Next, y aquí se
 * mantiene ese mismo criterio también para errores de cliente.
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4 text-center">
      <Link href="/">
        <Logo size="md" />
      </Link>

      <div className="flex flex-col items-center gap-2">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger-text">
          <AlertTriangle size={24} aria-hidden="true" />
        </span>
        <h1 className="font-display text-page-title font-semibold text-text-primary">
          Algo salió mal
        </h1>
        <p className="max-w-sm text-body-secondary text-text-secondary">
          Ocurrió un error inesperado. Puedes intentarlo de nuevo o volver al
          inicio.
        </p>
        {error.digest && (
          <p className="text-caption text-text-faint">
            Referencia: {error.digest}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <Button onClick={() => retry()}>Intentar de nuevo</Button>
        <Link
          href="/"
          className="inline-flex items-center rounded-button border border-brand-primary px-4 py-2 text-body-secondary font-semibold text-brand-primary transition hover:bg-brand-primary-soft"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";

/**
 * Implementación compartida para los not-found.tsx del dashboard. Cada
 * segmento (paciente, consulta, documento) pasa su propio mensaje y destino
 * de regreso — not-found.js no recibe params, así que el contexto viene del
 * propio archivo que la usa, no de la URL.
 */
export function NotFoundPanel({
  title,
  message,
  backHref,
  backLabel,
}: {
  title: string;
  message: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-soft text-text-faint">
        <SearchX size={24} aria-hidden="true" />
      </span>
      <div>
        <h1 className="font-display text-page-title font-semibold text-text-primary">
          {title}
        </h1>
        <p className="mt-1 text-body-secondary text-text-secondary">{message}</p>
      </div>
      <Link
        href={backHref}
        className="text-body-secondary font-medium text-brand-primary hover:underline"
      >
        {backLabel}
      </Link>
    </div>
  );
}

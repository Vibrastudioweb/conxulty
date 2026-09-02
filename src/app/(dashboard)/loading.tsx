import { Skeleton } from "@/components/feedback/Skeleton";

/**
 * Fallback de carga compartido por defecto para toda ruta bajo (dashboard)
 * que no defina su propio loading.tsx más específico (Next.js resuelve el
 * loading.tsx más cercano al segmento que está navegando). El AppShell del
 * layout sigue montado durante la navegación — esto solo reemplaza el
 * contenido de la página.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <Skeleton className="h-6 w-32" />
      <div className="mt-6 space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}

import Link from "next/link";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { listarCitasDelDia } from "@/modules/core/citas";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CitaCard } from "@/components/citas/CitaCard";
import { fechaDesdeParam, formatearFechaISO, sumarDias } from "@/components/citas/fecha";

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ fecha?: string }>;
}) {
  const { session, medico } = await requireMedicoSesion();
  const { fecha: fechaParam } = await searchParams;

  const fecha = fechaDesdeParam(fechaParam);
  const fechaISO = formatearFechaISO(fecha);
  const hoyISO = formatearFechaISO(new Date());
  const anteriorISO = formatearFechaISO(sumarDias(fecha, -1));
  const siguienteISO = formatearFechaISO(sumarDias(fecha, 1));

  const citas = await listarCitasDelDia({
    organizacionId: session.user.organizacionId,
    medicoId: medico.id,
    fecha,
  });

  const etiquetaFecha = fecha.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <PageHeader title="Agenda" />

      <div className="mt-4 flex items-center justify-between gap-2">
        <Link
          href={`/agenda?fecha=${anteriorISO}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          ← Anterior
        </Link>
        <div className="text-center">
          <p className="text-sm font-medium capitalize text-text-primary">
            {etiquetaFecha}
          </p>
          {fechaISO !== hoyISO && (
            <Link
              href={`/agenda?fecha=${hoyISO}`}
              className="text-xs text-brand-primary hover:underline"
            >
              Volver a hoy
            </Link>
          )}
        </div>
        <Link
          href={`/agenda?fecha=${siguienteISO}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          Siguiente →
        </Link>
      </div>

      <section className="mt-6">
        {citas.length === 0 ? (
          <EmptyState message="No hay citas para este día." />
        ) : (
          <ul className="space-y-2">
            {citas.map((cita) => (
              <li key={cita.id}>
                <CitaCard cita={cita} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-8 space-y-2 border-t border-border pt-4">
        <Link
          href={`/agenda/nueva?fecha=${fechaISO}`}
          className="block text-sm font-medium text-brand-primary hover:underline"
        >
          + Nueva cita
        </Link>
        <Link
          href="/hoy"
          className="block text-sm text-text-secondary hover:underline"
        >
          ← Volver a Hoy
        </Link>
      </div>
    </main>
  );
}

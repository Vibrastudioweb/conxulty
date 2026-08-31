import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import { listarCitasDelDia } from "@/modules/core/citas";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CitaCard } from "@/components/citas/CitaCard";

export default async function HoyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.rol !== "MEDICO") {
    redirect(session.user.rol === "ADMIN" ? "/admin" : "/staff");
  }

  let medico;
  try {
    medico = await resolverMedicoAutenticado({
      organizacionId: session.user.organizacionId,
      usuarioId: session.user.id,
    });
  } catch {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
        <p className="text-sm text-text-secondary">
          Tu usuario no tiene un perfil médico asociado. Contacta a un
          administrador de tu organización.
        </p>
      </main>
    );
  }

  const citas = await listarCitasDelDia({
    organizacionId: session.user.organizacionId,
    medicoId: medico.id,
    fecha: new Date(),
  });

  const proxima = citas.find(
    (cita) => cita.estado === "PENDIENTE" || cita.estado === "CONFIRMADA",
  );

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <PageHeader title="Hoy" />

      {proxima && (
        <section className="mt-4">
          <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
            Próxima cita
          </h2>
          <div className="mt-2">
            <CitaCard cita={proxima} destacada />
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Citas de hoy
        </h2>
        {citas.length === 0 ? (
          <div className="mt-2">
            <EmptyState message="No tienes citas para hoy." />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
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
          href="/agenda"
          className="block text-sm font-medium text-brand-primary hover:underline"
        >
          Ver agenda
        </Link>
        <Link
          href="/pacientes"
          className="block text-sm font-medium text-brand-primary hover:underline"
        >
          + Nueva consulta sin cita
        </Link>
      </div>
    </main>
  );
}

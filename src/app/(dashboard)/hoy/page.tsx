import { redirect } from "next/navigation";
import { CalendarDays, UserPlus } from "lucide-react";
import { auth } from "@/auth";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import { destinoPorRol } from "@/modules/core/autorizacion";
import { listarCitasDelDia } from "@/modules/core/citas";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { QuickAction } from "@/components/ui/QuickAction";
import { CitaCard } from "@/components/citas/CitaCard";

function formatearFechaLarga(fecha: Date): string {
  const texto = fecha.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function HoyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.rol !== "MEDICO") {
    redirect(destinoPorRol(session.user.rol));
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

  const ahora = new Date();
  const citas = await listarCitasDelDia({
    organizacionId: session.user.organizacionId,
    medicoId: medico.id,
    fecha: ahora,
  });

  const proxima = citas.find(
    (cita) => cita.estado === "PENDIENTE" || cita.estado === "CONFIRMADA",
  );
  const atendidas = citas.filter((cita) => cita.estado === "ATENDIDA").length;
  const hayCitas = citas.length > 0;

  const accionesRapidas = (
    <>
      <QuickAction href="/agenda" icon={CalendarDays} label="Ver agenda" />
      <QuickAction
        href="/pacientes"
        icon={UserPlus}
        label="Nueva consulta sin cita"
        variant="primary"
      />
    </>
  );

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <header>
        <h1 className="font-display text-page-title font-semibold tracking-tight text-text-primary lg:text-display">
          Hoy
        </h1>
        <p className="mt-1 text-body-secondary font-medium text-text-secondary lg:text-body">
          {formatearFechaLarga(ahora)}
        </p>
      </header>

      {!hayCitas ? (
        <section className="mt-8 rounded-card bg-brand-primary-soft px-6 py-10 text-center lg:mt-10 lg:py-12">
          <p className="text-section-title font-semibold text-text-primary">
            Tu agenda está despejada
          </p>
          <p className="mt-1 text-body-secondary text-text-secondary">
            Hoy no tienes consultas programadas.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {accionesRapidas}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-card bg-brand-primary-soft px-5 py-4 lg:mt-10">
            <p className="text-section-title font-semibold text-text-primary">
              Tu jornada de hoy
            </p>
            <p className="mt-0.5 text-body-secondary text-text-secondary">
              {citas.length} {citas.length === 1 ? "consulta" : "consultas"}{" "}
              programada{citas.length === 1 ? "" : "s"}
              {atendidas > 0 &&
                ` · ${atendidas} atendida${atendidas === 1 ? "" : "s"}`}
            </p>
          </section>

          {proxima && (
            <section className="mt-8">
              <SectionLabel>Próxima consulta</SectionLabel>
              <div className="mt-2">
                <CitaCard cita={proxima} destacada />
              </div>
            </section>
          )}

          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Agenda</SectionLabel>
              <span className="text-caption text-text-faint">
                {citas.length} {citas.length === 1 ? "cita" : "citas"}
              </span>
            </div>
            <div className="mt-3 divide-y divide-border">
              {citas.map((cita) => (
                <CitaCard key={cita.id} cita={cita} variant="row" />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <SectionLabel>Acciones rápidas</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {accionesRapidas}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import { obtenerPaciente } from "@/modules/core/pacientes";
import { obtenerCita } from "@/modules/core/citas";
import { listarConsultasDelPaciente } from "@/modules/core/consultas";
import { iniciarConsultaAction } from "./actions";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConsultaHistorialCard } from "@/components/consultas/ConsultaHistorialCard";

export default async function PacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cita?: string }>;
}) {
  const session = await requireMedico();

  const { id } = await params;
  const { cita: citaId } = await searchParams;

  const paciente = await obtenerPaciente({
    organizacionId: session.user.organizacionId,
    pacienteId: id,
  });

  if (!paciente) {
    notFound();
  }

  const cita = citaId
    ? await obtenerCita({
        organizacionId: session.user.organizacionId,
        citaId,
      })
    : null;

  const consultasPrevias = await listarConsultasDelPaciente({
    organizacionId: session.user.organizacionId,
    pacienteId: paciente.id,
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <Link href="/hoy" className="text-sm text-brand-primary hover:underline">
        ← Volver a Hoy
      </Link>

      <h1 className="mt-2 font-display text-lg font-semibold text-text-primary">
        {paciente.nombre} {paciente.apellido}
      </h1>

      <dl className="mt-3 space-y-1 text-sm text-text-secondary">
        {paciente.telefono && <div>Tel: {paciente.telefono}</div>}
        {paciente.email && <div>Email: {paciente.email}</div>}
        {paciente.fechaNacimiento && (
          <div>
            Nacimiento: {paciente.fechaNacimiento.toLocaleDateString("es")}
          </div>
        )}
        {!paciente.telefono && !paciente.email && !paciente.fechaNacimiento && (
          <div className="text-text-secondary">Sin datos adicionales.</div>
        )}
      </dl>

      {cita && (
        <div className="mt-3">
          <Card padding="cozy">
            <span className="text-text-secondary">
              Cita de hoy — {cita.estado}
              {cita.consulta && " · consulta ya iniciada"}
            </span>
          </Card>
        </div>
      )}

      <form action={iniciarConsultaAction} className="mt-6">
        <input type="hidden" name="pacienteId" value={paciente.id} />
        {citaId && <input type="hidden" name="citaId" value={citaId} />}
        <Button type="submit" fullWidth>
          {cita?.consulta ? "Continuar consulta" : "Iniciar consulta"}
        </Button>
      </form>

      <section className="mt-8 border-t border-border pt-4">
        <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
          Historia clínica
        </h2>
        {consultasPrevias.length === 0 ? (
          <div className="mt-2">
            <EmptyState message="Sin consultas anteriores." />
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
            {consultasPrevias.map((consulta) => (
              <li key={consulta.id}>
                <ConsultaHistorialCard consulta={consulta} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

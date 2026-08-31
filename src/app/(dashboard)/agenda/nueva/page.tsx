import Link from "next/link";
import { requireMedico } from "@/modules/core/autorizacion";
import { buscarPacientes, obtenerPaciente } from "@/modules/core/pacientes";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { fechaDesdeParam, formatearFechaISO } from "@/components/citas/fecha";
import { crearCitaAction } from "../actions";

export default async function NuevaCitaPage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha?: string;
    pacienteId?: string;
    q?: string;
    error?: string;
  }>;
}) {
  const session = await requireMedico();
  const { fecha, pacienteId, q, error } = await searchParams;

  const fechaSeleccionada = formatearFechaISO(fechaDesdeParam(fecha));

  const paciente = pacienteId
    ? await obtenerPaciente({
        organizacionId: session.user.organizacionId,
        pacienteId,
      })
    : null;

  if (!paciente) {
    const resultados = q
      ? await buscarPacientes({
          organizacionId: session.user.organizacionId,
          texto: q,
        })
      : [];

    return (
      <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
        <Link href="/agenda" className="text-sm text-brand-primary hover:underline">
          ← Volver a Agenda
        </Link>
        <h1 className="mt-2 font-display text-lg font-semibold text-text-primary">
          Nueva cita
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Selecciona un paciente para continuar.
        </p>

        <form method="get" className="mt-4">
          <input type="hidden" name="fecha" value={fechaSeleccionada} />
          <Input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nombre o apellido"
          />
        </form>

        {q && (
          <ul className="mt-4 space-y-2">
            {resultados.length === 0 && (
              <li>
                <EmptyState message="Sin resultados." />
              </li>
            )}
            {resultados.map((p) => (
              <li key={p.id}>
                <Card
                  href={`/agenda/nueva?fecha=${fechaSeleccionada}&pacienteId=${p.id}`}
                >
                  {p.nombre} {p.apellido}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <Link
        href={`/agenda/nueva?fecha=${fechaSeleccionada}`}
        className="text-sm text-brand-primary hover:underline"
      >
        ← Cambiar paciente
      </Link>
      <h1 className="mt-2 font-display text-lg font-semibold text-text-primary">
        Nueva cita
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        {paciente.nombre} {paciente.apellido}
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="danger">
            {error === "conflicto"
              ? "Ya existe una cita en ese horario."
              : "Completa fecha, hora y paciente."}
          </Alert>
        </div>
      )}

      <form action={crearCitaAction} className="mt-4 space-y-4">
        <input type="hidden" name="pacienteId" value={paciente.id} />

        <div>
          <label
            htmlFor="fecha"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Fecha
          </label>
          <Input
            id="fecha"
            name="fecha"
            type="date"
            defaultValue={fechaSeleccionada}
            required
          />
        </div>

        <div>
          <label
            htmlFor="hora"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Hora
          </label>
          <Input id="hora" name="hora" type="time" required />
        </div>

        <div>
          <label
            htmlFor="motivo"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Motivo (opcional)
          </label>
          <Textarea id="motivo" name="motivo" rows={2} />
        </div>

        <Button type="submit" fullWidth>
          Guardar cita
        </Button>
      </form>
    </main>
  );
}

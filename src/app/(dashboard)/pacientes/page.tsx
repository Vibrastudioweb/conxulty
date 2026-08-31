import Link from "next/link";
import { requireMedico } from "@/modules/core/autorizacion";
import { buscarPacientes } from "@/modules/core/pacientes";
import { crearPacienteAction } from "./actions";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const session = await requireMedico();

  const { q, error } = await searchParams;

  const resultados = q
    ? await buscarPacientes({
        organizacionId: session.user.organizacionId,
        texto: q,
      })
    : [];

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <Link href="/hoy" className="text-sm text-brand-primary hover:underline">
        ← Volver a Hoy
      </Link>
      <h1 className="mt-2 font-display text-lg font-semibold text-text-primary">
        Pacientes
      </h1>

      <form method="get" className="mt-4">
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
          {resultados.map((paciente) => (
            <li key={paciente.id}>
              <Card href={`/pacientes/${paciente.id}`}>
                {paciente.nombre} {paciente.apellido}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <details className="mt-6">
        <summary className="cursor-pointer text-sm font-medium text-brand-primary">
          + Nuevo paciente
        </summary>
        <form action={crearPacienteAction} className="mt-3 space-y-3">
          {error && <Alert tone="danger">Completa nombre y apellido.</Alert>}
          <Input name="nombre" placeholder="Nombre" required />
          <Input name="apellido" placeholder="Apellido" required />
          <Input name="telefono" placeholder="Teléfono (opcional)" />
          <Button type="submit">Crear paciente</Button>
        </form>
      </details>
    </main>
  );
}

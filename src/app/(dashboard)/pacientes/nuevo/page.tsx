import Link from "next/link";
import { requireMedico } from "@/modules/core/autorizacion";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PacienteFormFields } from "@/components/pacientes/PacienteFormFields";
import { crearPacienteAction } from "../actions";

export default async function NuevoPacientePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireMedico();
  const { error } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-2xl lg:px-10 lg:py-12">
      <PageHeader
        title="Nuevo paciente"
        context={
          <Link href="/pacientes" className="text-sm text-brand-primary hover:underline">
            ← Volver a Pacientes
          </Link>
        }
      />

      {error && (
        <div className="mt-4">
          <Alert tone="danger">
            {error === "documento_duplicado"
              ? "Ya existe un paciente con ese documento de identidad."
              : error === "fecha_invalida"
                ? "La fecha de nacimiento no es válida."
                : "Completa nombre y apellido, y revisa que el email tenga un formato válido."}
          </Alert>
        </div>
      )}

      <form action={crearPacienteAction} className="mt-6 space-y-6">
        <PacienteFormFields />
        <Button type="submit" fullWidth>
          Crear paciente
        </Button>
      </form>
    </main>
  );
}

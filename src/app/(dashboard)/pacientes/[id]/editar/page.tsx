import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import { obtenerPaciente } from "@/modules/core/pacientes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PacienteFormFields } from "@/components/pacientes/PacienteFormFields";
import { formatearFechaISO } from "@/components/citas/fecha";
import { actualizarPacienteAction } from "../actions";

export default async function EditarPacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireMedico();
  const { id } = await params;
  const { error } = await searchParams;

  const paciente = await obtenerPaciente({
    organizacionId: session.user.organizacionId,
    pacienteId: id,
  });

  if (!paciente) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-2xl lg:px-10 lg:py-12">
      <PageHeader
        title="Editar paciente"
        description={`${paciente.nombre} ${paciente.apellido}`}
        context={
          <Link
            href={`/pacientes/${paciente.id}`}
            className="text-sm text-brand-primary hover:underline"
          >
            ← Volver a la ficha
          </Link>
        }
      />

      {error && (
        <div className="mt-4">
          <Alert tone="danger">
            {error === "documento_duplicado"
              ? "Ya existe otro paciente con ese documento de identidad."
              : error === "fecha_invalida"
                ? "La fecha de nacimiento no es válida."
                : "Completa nombre y apellido, y revisa que el email tenga un formato válido."}
          </Alert>
        </div>
      )}

      <form action={actualizarPacienteAction} className="mt-6 space-y-6">
        <input type="hidden" name="pacienteId" value={paciente.id} />
        <PacienteFormFields
          valores={{
            nombre: paciente.nombre,
            apellido: paciente.apellido,
            fechaNacimiento: paciente.fechaNacimiento
              ? formatearFechaISO(paciente.fechaNacimiento)
              : undefined,
            sexo: paciente.sexo ?? undefined,
            telefono: paciente.telefono ?? undefined,
            email: paciente.email ?? undefined,
            documentoIdentidad: paciente.documentoIdentidad ?? undefined,
            direccion: paciente.direccion ?? undefined,
            contactoEmergenciaNombre: paciente.contactoEmergenciaNombre ?? undefined,
            contactoEmergenciaTelefono: paciente.contactoEmergenciaTelefono ?? undefined,
          }}
        />
        <Button type="submit" fullWidth>
          Guardar cambios
        </Button>
      </form>
    </main>
  );
}

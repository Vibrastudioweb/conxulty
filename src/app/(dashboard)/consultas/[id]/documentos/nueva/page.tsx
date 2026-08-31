import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerConsulta } from "@/modules/core/consultas";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { emitirRecetaAction } from "../actions";

const NUMERO_LINEAS_MEDICAMENTO = 4;

export default async function NuevaRecetaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { session, medico } = await requireMedicoSesion();
  const { id } = await params;
  const { error } = await searchParams;

  const consulta = await obtenerConsulta({
    organizacionId: session.user.organizacionId,
    consultaId: id,
  });

  // Solo el médico dueño de la consulta puede emitir, y nunca sobre una
  // consulta ANULADA — mismo criterio que en la página de la consulta.
  if (
    !consulta ||
    consulta.medicoId !== medico.id ||
    consulta.estado === "ANULADA"
  ) {
    notFound();
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <Link
        href={`/consultas/${id}`}
        className="text-sm text-brand-primary hover:underline"
      >
        ← Volver a la consulta
      </Link>
      <h1 className="mt-2 font-display text-lg font-semibold text-text-primary">
        Nueva receta
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        {consulta.paciente.nombre} {consulta.paciente.apellido}
      </p>

      {error && (
        <div className="mt-3">
          <Alert tone="danger">Agrega al menos un medicamento.</Alert>
        </div>
      )}

      <form action={emitirRecetaAction} className="mt-4 space-y-5">
        <input type="hidden" name="consultaId" value={id} />

        {Array.from({ length: NUMERO_LINEAS_MEDICAMENTO }).map((_, i) => (
          <div key={i} className="space-y-2">
            <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
              Medicamento {i + 1}
              {i === 0 ? "" : " (opcional)"}
            </h2>
            <Input
              name={`medicamentoNombre${i + 1}`}
              placeholder="Nombre y presentación (ej. Amoxicilina 500mg)"
            />
            <Input
              name={`medicamentoIndicaciones${i + 1}`}
              placeholder="Indicaciones (ej. 1 cápsula cada 8h por 7 días)"
            />
          </div>
        ))}

        <div>
          <label
            htmlFor="indicacionesGenerales"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Indicaciones generales (opcional)
          </label>
          <Textarea id="indicacionesGenerales" name="indicacionesGenerales" rows={2} />
        </div>

        <Button type="submit" fullWidth>
          Emitir receta
        </Button>
      </form>
    </main>
  );
}

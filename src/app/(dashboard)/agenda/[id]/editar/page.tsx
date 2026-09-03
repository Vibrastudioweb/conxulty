import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerCita, citaEsEditable } from "@/modules/core/citas";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ETIQUETAS_MODALIDAD } from "@/components/citas/CitaCard";
import { formatearFechaISO, formatearHoraInput } from "@/components/citas/fecha";
import { actualizarCitaAction } from "../../actions";

export default async function EditarCitaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; volverA?: string }>;
}) {
  const { session, medico } = await requireMedicoSesion();
  const { id } = await params;
  const { error, volverA } = await searchParams;

  const cita = await obtenerCita({
    organizacionId: session.user.organizacionId,
    citaId: id,
  });

  if (!cita || cita.medicoId !== medico.id) {
    notFound();
  }

  const editable = citaEsEditable(cita.estado);
  const destino = volverA ?? `/agenda?fecha=${formatearFechaISO(cita.fechaHora)}`;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <Link href={destino} className="text-sm text-brand-primary hover:underline">
        ← Volver a Agenda
      </Link>
      <h1 className="mt-2 font-display text-lg font-semibold text-text-primary">
        Editar cita
      </h1>
      <p className="mt-1 text-sm text-text-secondary">
        {cita.paciente.nombre} {cita.paciente.apellido}
      </p>

      {!editable && (
        <div className="mt-3">
          <Alert tone="warning">
            Esta cita está {cita.estado.toLowerCase().replace("_", " ")} y ya
            no puede editarse.
          </Alert>
        </div>
      )}

      {editable && error && (
        <div className="mt-3">
          <Alert tone="danger">
            {error === "conflicto"
              ? "Ya existe una cita en ese horario."
              : "Completa fecha y hora correctamente."}
          </Alert>
        </div>
      )}

      {editable && (
        <form action={actualizarCitaAction} className="mt-4 space-y-4">
          <input type="hidden" name="citaId" value={cita.id} />
          <input type="hidden" name="volverA" value={destino} />

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
              defaultValue={formatearFechaISO(cita.fechaHora)}
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
            <Input
              id="hora"
              name="hora"
              type="time"
              defaultValue={formatearHoraInput(cita.fechaHora)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="duracionMinutos"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                Duración (min)
              </label>
              <Input
                id="duracionMinutos"
                name="duracionMinutos"
                type="number"
                min={5}
                max={480}
                step={5}
                defaultValue={cita.duracionMinutos}
                required
              />
            </div>

            <div>
              <label
                htmlFor="modalidad"
                className="mb-1 block text-sm font-medium text-text-primary"
              >
                Modalidad
              </label>
              <select
                id="modalidad"
                name="modalidad"
                defaultValue={cita.modalidad}
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {Object.entries(ETIQUETAS_MODALIDAD).map(([valor, etiqueta]) => (
                  <option key={valor} value={valor}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="motivo"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Motivo (opcional)
            </label>
            <Textarea
              id="motivo"
              name="motivo"
              rows={2}
              defaultValue={cita.motivo ?? ""}
            />
          </div>

          <div>
            <label
              htmlFor="notas"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Notas operativas (opcional)
            </label>
            <Textarea
              id="notas"
              name="notas"
              rows={2}
              defaultValue={cita.notas ?? ""}
              placeholder="Solo información de agenda, no clínica."
            />
          </div>

          <Button type="submit" fullWidth>
            Guardar cambios
          </Button>
        </form>
      )}
    </main>
  );
}

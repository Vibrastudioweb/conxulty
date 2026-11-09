import { Button } from "@/components/ui/Button";
import { OdontogramaDiagrama } from "./OdontogramaDiagrama";
import type { Odontograma } from "@/modules/consultas/odontograma";

/**
 * Odontograma (ver changelog puntos 51/51b) — el diagrama clickeable vive
 * en `OdontogramaDiagrama` (componente de cliente); este formulario sigue
 * siendo un Server Component normal, igual que el resto de la ficha del
 * paciente, con un `<textarea>` de notas generales sin JS adicional.
 */
export function OdontogramaSeccion({
  pacienteId,
  odontograma,
  notasOdontograma,
  action,
}: {
  pacienteId: string;
  odontograma: Odontograma;
  notasOdontograma: string | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-2 space-y-4">
      <input type="hidden" name="pacienteId" value={pacienteId} />

      <OdontogramaDiagrama odontograma={odontograma} />

      <div>
        <label
          htmlFor="notasOdontograma"
          className="mb-1 block text-caption font-medium text-text-primary"
        >
          Notas generales
        </label>
        <textarea
          id="notasOdontograma"
          name="notasOdontograma"
          defaultValue={notasOdontograma ?? ""}
          rows={3}
          maxLength={2000}
          placeholder="Observaciones generales sobre la boca del paciente (no es por diente)."
          className="w-full rounded-input border border-border bg-surface px-3 py-2 text-body-secondary text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        />
      </div>

      <Button type="submit" variant="secondary" fullWidth>
        Guardar odontograma
      </Button>
    </form>
  );
}

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  CUADRANTES_FDI,
  ESTADOS_DIENTE,
  LABEL_ESTADO_DIENTE,
  type Odontograma,
} from "@/modules/consultas/odontograma";

/**
 * Odontograma básico (ver changelog punto 51) — un `<select>` nativo por
 * diente, sin JavaScript de cliente, mismo criterio que el resto de la
 * app. No es un dibujo/gráfico de diente clickeable (eso sí necesitaría
 * JS); es la versión más simple que cumple lo pedido ("sin complicarlo"):
 * elegir un estado por diente de una lista cerrada.
 */
export function OdontogramaSeccion({
  pacienteId,
  odontograma,
  action,
}: {
  pacienteId: string;
  odontograma: Odontograma;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} className="mt-2 space-y-4">
      <input type="hidden" name="pacienteId" value={pacienteId} />
      {CUADRANTES_FDI.map((cuadrante) => (
        <Card key={cuadrante.nombre} padding="cozy">
          <p className="text-caption font-semibold text-text-secondary">{cuadrante.nombre}</p>
          <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
            {cuadrante.dientes.map((numero) => (
              <label key={numero} className="text-center text-xs text-text-faint">
                {numero}
                <select
                  name={`diente_${numero}`}
                  defaultValue={odontograma[numero] ?? "SANO"}
                  className="mt-1 w-full rounded-input border border-border bg-surface px-1 py-1 text-xs text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {ESTADOS_DIENTE.map((estado) => (
                    <option key={estado} value={estado}>
                      {LABEL_ESTADO_DIENTE[estado]}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </Card>
      ))}
      <Button type="submit" variant="secondary" fullWidth>
        Guardar odontograma
      </Button>
    </form>
  );
}

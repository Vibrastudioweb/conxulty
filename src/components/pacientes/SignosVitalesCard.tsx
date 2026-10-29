import { Card } from "@/components/ui/Card";
import type { ConsultaHistorial } from "@/components/consultas/ConsultaHistorialCard";

/**
 * Signos vitales de la consulta más reciente que tenga al menos uno
 * registrado (29-oct-2026, ver changelog de la demo punto 6 — campos
 * agregados al esquema real en este mismo cambio, ver prisma/schema.prisma
 * y el formulario de /consultas/[id]). El IMC se calcula aquí, no se
 * guarda: depende de peso Y talla de la MISMA consulta, para no mezclar un
 * peso reciente con una talla antigua.
 */
export function SignosVitalesCard({
  consultas,
}: {
  consultas: ConsultaHistorial[];
}) {
  const conVitales = consultas.find(
    (c) =>
      c.presionArterial ||
      c.frecuenciaCardiaca != null ||
      c.temperatura != null ||
      c.saturacionOxigeno != null ||
      c.pesoKg != null ||
      c.tallaCm != null,
  );

  if (!conVitales) {
    return (
      <Card padding="cozy">
        <p className="text-body-secondary text-text-faint">
          Sin signos vitales registrados todavía.
        </p>
      </Card>
    );
  }

  const peso = conVitales.pesoKg != null ? Number(conVitales.pesoKg) : null;
  const talla = conVitales.tallaCm != null ? Number(conVitales.tallaCm) : null;
  const imc =
    peso != null && talla != null && talla > 0
      ? peso / (talla / 100) ** 2
      : null;

  const filas: Array<{ label: string; value: string }> = [];
  if (conVitales.presionArterial)
    filas.push({ label: "Presión arterial", value: conVitales.presionArterial });
  if (conVitales.frecuenciaCardiaca != null)
    filas.push({ label: "Frec. cardíaca", value: `${conVitales.frecuenciaCardiaca} lpm` });
  if (conVitales.temperatura != null)
    filas.push({ label: "Temperatura", value: `${conVitales.temperatura} °C` });
  if (conVitales.saturacionOxigeno != null)
    filas.push({ label: "Sat. O₂", value: `${conVitales.saturacionOxigeno}%` });
  if (peso != null) filas.push({ label: "Peso", value: `${peso} kg` });
  if (talla != null) filas.push({ label: "Talla", value: `${talla} cm` });
  if (imc != null) filas.push({ label: "IMC", value: imc.toFixed(1) });

  return (
    <Card padding="cozy">
      <p className="text-caption text-text-faint">
        {conVitales.fechaHora.toLocaleDateString("es", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      </p>
      <dl className="mt-2 grid grid-cols-2 gap-2">
        {filas.map((fila) => (
          <div key={fila.label}>
            <dt className="text-caption text-text-faint">{fila.label}</dt>
            <dd className="text-body-secondary font-medium text-text-primary">
              {fila.value}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

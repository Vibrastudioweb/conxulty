import {
  LABEL_ESTADO_DIENTE,
  type EstadoDiente,
  type Odontograma,
} from "@/modules/consultas/odontograma";

/**
 * Versiones anteriores del odontograma de un paciente (13-nov-2026,
 * auditoría del núcleo clínico).
 *
 * POR QUÉ EXISTE: hasta ahora cada guardado pisaba al anterior, y para un
 * odontólogo el valor clínico está justamente en la evolución — cómo
 * estaba el diente antes del tratamiento y cómo quedó. Sin esto, el
 * odontograma solo contaba el presente.
 *
 * Deliberadamente simple: fecha y qué dientes estaban marcados en cada
 * versión. Comparar dos versiones lado a lado sería mejor, pero esto ya
 * recupera la información que se estaba perdiendo, que es lo urgente.
 */
export interface VersionOdontograma {
  id: string;
  estado: unknown;
  notas: string | null;
  createdAt: Date;
}

function fechaLarga(fecha: Date): string {
  return fecha.toLocaleDateString("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function HistorialOdontogramaSeccion({
  versiones,
}: {
  versiones: VersionOdontograma[];
}) {
  // La primera es la foto actual, que ya se ve arriba en el odontograma.
  const anteriores = versiones.slice(1);
  if (anteriores.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-4">
      <h2 className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        Versiones anteriores
      </h2>
      <ul className="mt-2 space-y-2">
        {anteriores.map((version) => {
          const estado = (version.estado as Odontograma | null) ?? {};
          const dientes = Object.entries(estado);
          return (
            <li
              key={version.id}
              className="rounded-card border border-border bg-surface px-3 py-2"
            >
              <p className="text-body-secondary font-medium text-text-primary">
                {fechaLarga(version.createdAt)}
              </p>
              {dientes.length === 0 ? (
                <p className="mt-1 text-body-secondary text-text-secondary">
                  Sin dientes marcados.
                </p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {dientes.map(([numero, valor]) => (
                    <li key={numero} className="text-body-secondary text-text-secondary">
                      <span className="font-medium text-text-primary">{numero}</span>{" "}
                      {LABEL_ESTADO_DIENTE[valor as EstadoDiente] ?? valor}
                    </li>
                  ))}
                </ul>
              )}
              {version.notas && (
                <p className="mt-1 text-body-secondary text-text-secondary">{version.notas}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

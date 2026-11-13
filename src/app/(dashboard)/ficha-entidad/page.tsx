import { prisma } from "@/db/client";
import { requireEntidadSesion } from "@/modules/core/autorizacion";
import { obtenerFichaEntidadDirectorio } from "@/modules/directorio/sincronizacionEntidad";
import { Alert } from "@/components/ui/Alert";
import { FichaEntidadForm } from "./FichaEntidadForm";

export const metadata = { title: "Mi ficha pública — CONXULTY" };

/**
 * "Mi ficha pública" de clínica/farmacia — ver changelog punto 90/92.
 * Equivalente de (dashboard)/ficha-publica, pero para el rol ENTIDAD: sin
 * sedes múltiples (una entidad tiene una sola ubicación) ni foto (galería
 * es tarea aparte) todavía.
 */
export default async function FichaEntidadPage() {
  const { session, entidad } = await requireEntidadSesion();

  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: {
      nombre: true,
      fichaDirectorioId: true,
      fichaDirectorioSlug: true,
      fichaDirectorioSincronizada: true,
    },
  });

  const directorio = await obtenerFichaEntidadDirectorio(organizacion.fichaDirectorioId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <h1 className="text-h2 font-semibold text-text-primary">Mi ficha pública</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Lo que ve cualquier persona en el Directorio CONXULTY cuando busca tu
        centro.
      </p>

      {!organizacion.fichaDirectorioSincronizada && (
        <div className="mt-4">
          <Alert tone="warning" title="Todavía no se publicó">
            Tu ficha no se sincronizó con el Directorio todavía. Completa el
            formulario y guarda para intentarlo.
          </Alert>
        </div>
      )}

      {organizacion.fichaDirectorioSincronizada && organizacion.fichaDirectorioSlug && (
        <div className="mt-4">
          <Alert tone="success" title="Publicada">
            Visible en el Directorio CONXULTY.
            {/* Sin armar la URL pública exacta acá: el segmento de categoría
                (ej. /clinicas o /farmacias) sale del nombre_plural real de
                tipos_entidad en vitalud, que no se verificó desde este lado
                — no se inventa un path que podría estar mal. */}
          </Alert>
        </div>
      )}

      {!directorio.ok && (
        <div className="mt-4">
          <Alert tone="danger" title="No se pudo cargar el Directorio ahora">
            {directorio.error} — puedes seguir, pero no vas a poder guardar
            hasta que el Directorio responda.
          </Alert>
        </div>
      )}

      <div className="mt-6">
        <FichaEntidadForm
          nombre={organizacion.nombre}
          entidad={entidad}
          ficha={directorio.ok ? directorio.ficha : null}
          ciudades={directorio.ok ? directorio.ciudades : []}
        />
      </div>
    </div>
  );
}

import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerFichaDirectorio } from "@/modules/directorio/sincronizacion";
import { Alert } from "@/components/ui/Alert";
import { FichaPublicaForm } from "./FichaPublicaForm";

export const metadata = { title: "Mi ficha pública — CONXULTY" };

export default async function FichaPublicaPage() {
  const { session, medico } = await requireMedicoSesion();

  const [organizacion, sedes] = await Promise.all([
    prisma.organizacion.findUniqueOrThrow({
      where: { id: session.user.organizacionId },
      select: { fichaDirectorioId: true, fichaDirectorioSlug: true, fichaDirectorioSincronizada: true },
    }),
    prisma.sede.findMany({
      where: { medicoId: medico.id },
      select: { id: true, municipio: true, direccion: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const directorio = await obtenerFichaDirectorio(organizacion.fichaDirectorioId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <h1 className="text-h2 font-semibold text-text-primary">Mi ficha pública</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Lo que ve cualquier persona en el Directorio CONXULTY, y lo que lee
        un médico de otro consultorio cuando escaneas tu código. Tus
        pacientes y tu agenda no se tocan desde acá — esto es solo tu
        presencia pública.
      </p>

      {!organizacion.fichaDirectorioSincronizada && (
        <div className="mt-4">
          <Alert tone="warning" title="Todavía no se publicó">
            Tu ficha no se sincronizó con el Directorio todavía (puede haber
            fallado al registrarte, o tu profesión no se publica ahí por
            ahora). Completa el formulario y guarda para intentarlo.
          </Alert>
        </div>
      )}

      {organizacion.fichaDirectorioSincronizada && organizacion.fichaDirectorioSlug && (
        <div className="mt-4">
          <Alert tone="success" title="Publicada">
            Visible en conxulty.com/medico/{organizacion.fichaDirectorioSlug}
          </Alert>
        </div>
      )}

      {!directorio.ok && (
        <div className="mt-4">
          <Alert tone="danger" title="No se pudo cargar el Directorio ahora">
            {directorio.error} — podés seguir, pero no vas a poder guardar
            hasta que el Directorio responda.
          </Alert>
        </div>
      )}

      <div className="mt-6">
        <FichaPublicaForm
          ficha={directorio.ok ? directorio.ficha : null}
          ciudades={directorio.ok ? directorio.ciudades : []}
          sedesDirectorio={directorio.ok ? directorio.sedes : []}
          sedesOs={sedes}
        />
      </div>
    </div>
  );
}

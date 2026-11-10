import { Eye } from "lucide-react";
import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerFichaDirectorio } from "@/modules/directorio/sincronizacion";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
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
  const publicada = organizacion.fichaDirectorioSincronizada && Boolean(organizacion.fichaDirectorioSlug);
  const urlPublica = publicada ? `https://conxulty.com/medico/${organizacion.fichaDirectorioSlug}` : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Mi ficha pública"
        description="Lo que ve cualquier persona en el Directorio CONXULTY, y lo que lee un médico de otro consultorio cuando escaneas tu código. Tus pacientes y tu agenda no se tocan desde acá — esto es solo tu presencia pública."
        secondaryActions={
          urlPublica ? (
            <a
              href={urlPublica}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-button border border-brand-primary px-3 py-1.5 text-caption font-semibold text-brand-primary transition hover:bg-brand-primary-soft"
            >
              <Eye size={14} aria-hidden="true" />
              Cómo te ven tus pacientes
            </a>
          ) : (
            // Deshabilitado en vez de ocultarlo del todo: así el médico sabe
            // que el botón existe y qué falta para activarlo (10-nov-2026,
            // pedido explícito del usuario), en vez de que aparezca de la
            // nada la primera vez que publique.
            <span
              title="Se activa cuando guardes y publiques por primera vez"
              className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-faint"
            >
              <Eye size={14} aria-hidden="true" />
              Cómo te ven tus pacientes
            </span>
          )
        }
      />

      {(!organizacion.fichaDirectorioSincronizada || !directorio.ok) && (
        <div className="mt-4 space-y-3">
          {!organizacion.fichaDirectorioSincronizada && (
            <Alert tone="warning" title="Todavía no se publicó">
              Tu ficha no se sincronizó con el Directorio todavía (puede haber
              fallado al registrarte, o tu profesión no se publica ahí por
              ahora). Completa el formulario y guarda para intentarlo.
            </Alert>
          )}
          {!directorio.ok && (
            <Alert tone="danger" title="No se pudo cargar el Directorio ahora">
              {directorio.error} — podés seguir, pero no vas a poder guardar
              hasta que el Directorio responda.
            </Alert>
          )}
        </div>
      )}

      {publicada && (
        <div className="mt-4">
          <Alert tone="success" title="Publicada">
            Visible en conxulty.com/medico/{organizacion.fichaDirectorioSlug}
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

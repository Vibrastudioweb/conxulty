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

  const [organizacion, sedes, medicoCompleto] = await Promise.all([
    prisma.organizacion.findUniqueOrThrow({
      where: { id: session.user.organizacionId },
      select: { fichaDirectorioId: true, fichaDirectorioSlug: true, fichaDirectorioSincronizada: true },
    }),
    prisma.sede.findMany({
      where: { medicoId: medico.id },
      select: { id: true, municipio: true, direccion: true },
      orderBy: { createdAt: "asc" },
    }),
    // 10-nov-2026: cédula, MPPS, colegiado, especialidades secundarias y
    // zonas de cobertura se sacaron del registro ("menos pasos") — ahora se
    // llenan/editan acá, ver FichaPublicaForm.tsx.
    prisma.medico.findUniqueOrThrow({
      where: { id: medico.id },
      select: {
        profesion: true,
        especialidad: true,
        cedula: true,
        numeroMpps: true,
        numeroColegiado: true,
        especialidadesSecundarias: true,
        modalidades: true,
        zonasCobertura: true,
      },
    }),
  ]);

  const directorio = await obtenerFichaDirectorio(organizacion.fichaDirectorioId);

  // 10-nov-2026: antes esto no se sincronizaba — el OS guarda `especialidad`
  // como texto libre y el Directorio usa catálogo cerrado, mapear a ciegas
  // generaba coincidencias falsas (ver nota de alcance del endpoint en
  // vitalud). Ahora el médico ELIGE del catálogo real en un <select>; esto
  // solo PRESELECCIONA esa opción cuando el texto que ya tiene guardado
  // coincide exacto (sin mayúsculas/acentos) con una del catálogo — nunca
  // se guarda nada hasta que el médico mismo confirme con "Guardar y
  // publicar". Si ya había una especialidad elegida antes en el
  // Directorio (`ficha.especialidad_id`), ESA gana siempre sobre la
  // sugerencia por texto.
  function normalizar(texto: string): string {
    return texto
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }
  const especialidadesCatalogo = directorio.ok ? directorio.especialidades : [];
  const especialidadIdGuardada = directorio.ok ? (directorio.ficha?.especialidad_id ?? null) : null;
  const especialidadIdSugerida =
    !especialidadIdGuardada && medicoCompleto.especialidad
      ? (especialidadesCatalogo.find((e) => normalizar(e.nombre) === normalizar(medicoCompleto.especialidad!))
          ?.id ?? null)
      : null;
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
          profesion={medicoCompleto.profesion}
          cedula={medicoCompleto.cedula}
          numeroMpps={medicoCompleto.numeroMpps}
          numeroColegiado={medicoCompleto.numeroColegiado}
          especialidadesSecundarias={medicoCompleto.especialidadesSecundarias}
          atiendeDomicilio={medicoCompleto.modalidades.includes("DOMICILIO")}
          zonasCobertura={medicoCompleto.zonasCobertura}
          especialidades={especialidadesCatalogo}
          especialidadId={especialidadIdGuardada ?? especialidadIdSugerida}
        />
      </div>
    </div>
  );
}

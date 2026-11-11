import { Eye } from "lucide-react";
import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { obtenerFichaDirectorio } from "@/modules/directorio/sincronizacion";
import { type HorarioDia } from "@/modules/onboarding/horarioSede";
import { Alert } from "@/components/ui/Alert";
import { PageHeader } from "@/components/ui/PageHeader";
import { FichaPublicaForm } from "./FichaPublicaForm";

export const metadata = { title: "Mi ficha pública — CONXULTY" };

// Mismo límite que /registro (`SEDES_MAX` en registro/actions.ts) — una
// sede nueva de más acá tampoco tendría sentido del lado del Directorio.
const SEDES_MAX = 3;

export default async function FichaPublicaPage() {
  const { session, medico } = await requireMedicoSesion();

  const [organizacion, sedes, medicoCompleto] = await Promise.all([
    prisma.organizacion.findUniqueOrThrow({
      where: { id: session.user.organizacionId },
      select: { fichaDirectorioId: true, fichaDirectorioSlug: true, fichaDirectorioSincronizada: true },
    }),
    // 10-nov-2026: antes solo se traía `municipio`/`direccion` (lo mínimo
    // para emparejar con el Directorio) — ahora se trae todo porque esta
    // misma pantalla edita la sede real del OS ("donde edita un medico
    // sedes horarios y ubicaciones y modalidad de consultas" — antes no
    // existía esa pantalla en ningún lado, ver FichaPublicaForm.tsx).
    prisma.sede.findMany({
      where: { medicoId: medico.id },
      select: { id: true, municipio: true, direccion: true, referencia: true, horario: true },
      orderBy: { createdAt: "asc" },
    }),
    // 10-nov-2026: cédula, MPPS, colegiado, especialidades secundarias y
    // zonas de cobertura se sacaron del registro ("menos pasos") — ahora se
    // llenan/editan acá, ver FichaPublicaForm.tsx.
    prisma.medico.findUniqueOrThrow({
      where: { id: medico.id },
      select: {
        profesion: true,
        cedula: true,
        numeroMpps: true,
        numeroColegiado: true,
        especialidad: true,
        especialidadesSecundarias: true,
        modalidades: true,
        zonasCobertura: true,
        telefonoPublico: true,
      },
    }),
  ]);

  const directorio = await obtenerFichaDirectorio(organizacion.fichaDirectorioId);

  // 10-nov-2026 (corregido el mismo día): la especialidad PRINCIPAL se
  // había sacado de acá asumiendo que siempre se elegía en /registro — ya
  // no es así (/registro se simplificó: "poner todo lo demás en mi
  // ficha"), así que un médico nuevo no tenía dónde elegirla nunca. Vuelve
  // a ser un <select>/texto acá, igual que el que tenía /registro.
  const publicada = organizacion.fichaDirectorioSincronizada && Boolean(organizacion.fichaDirectorioSlug);
  const urlPublica = publicada ? `https://conxulty.com/medico/${organizacion.fichaDirectorioSlug}` : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <PageHeader
        title="Mi ficha pública"
        description="Lo que ve cualquier persona en el Directorio CONXULTY, y lo que lee un médico de otro consultorio cuando escaneas tu código. Tus pacientes no se tocan desde acá, pero las sedes y modalidades sí son las mismas que usa tu agenda — un cambio acá se refleja ahí también."
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
          sedesOs={sedes.map((s) => ({ ...s, horario: s.horario as unknown as HorarioDia[] }))}
          espaciosNuevaSede={Math.max(0, SEDES_MAX - sedes.length)}
          modalidadesActuales={medicoCompleto.modalidades}
          profesion={medicoCompleto.profesion}
          cedula={medicoCompleto.cedula}
          numeroMpps={medicoCompleto.numeroMpps}
          numeroColegiado={medicoCompleto.numeroColegiado}
          especialidad={medicoCompleto.especialidad}
          especialidadesSecundarias={medicoCompleto.especialidadesSecundarias}
          zonasCobertura={medicoCompleto.zonasCobertura}
          telefonoPublico={medicoCompleto.telefonoPublico}
        />
      </div>
    </div>
  );
}

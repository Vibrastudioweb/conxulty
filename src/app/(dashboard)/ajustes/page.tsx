import { requireSesion } from "@/modules/core/autorizacion";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";

/**
 * /ajustes — destino del icono de engranaje del topbar de la demo (ver
 * changelog punto 56). Deliberadamente "básica" (así se decidió): un
 * resumen de solo lectura de la cuenta, nada editable todavía. No duplica
 * Editar paciente/Editar perfil (no existen formularios de cuenta en el
 * producto real hoy) — si en el futuro se decide qué configuración real va
 * aquí (notificaciones, seguridad, datos de la organización), esta página
 * crece; por ahora, mostrar algo decorativo sin función real sería el
 * mismo error que ya se evitó con los iconos de cuadrícula de la demo.
 */
const ETIQUETAS_ROL: Record<string, string> = {
  MEDICO: "Médico",
  ADMIN: "Administrador",
  STAFF: "Staff",
  SUPERADMIN: "Super administrador",
};

const ETIQUETAS_PROFESION: Record<string, string> = {
  MEDICO: "Medicina general",
  ODONTOLOGO: "Odontología",
  PSICOLOGO: "Psicología",
  OTRA: "Otra",
};

export default async function AjustesPage() {
  const session = await requireSesion();

  let profesionLabel: string | null = null;
  if (session.user.rol === "MEDICO") {
    try {
      const medico = await resolverMedicoAutenticado({
        organizacionId: session.user.organizacionId,
        usuarioId: session.user.id,
      });
      profesionLabel = ETIQUETAS_PROFESION[medico.profesion] ?? medico.profesion;
    } catch {
      // Sin perfil médico asociado — mismo caso ya manejado en /hoy. Aquí
      // simplemente se omite la fila de profesión, no es bloqueante para
      // ver el resto de la cuenta.
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 pb-16 lg:max-w-2xl lg:px-10 lg:py-12">
      <PageHeader title="Ajustes" description="Datos de tu cuenta." />

      <section className="mt-6">
        <SectionLabel>Cuenta</SectionLabel>
        <Card padding="cozy" className="mt-2">
          <dl className="divide-y divide-border">
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-body-secondary text-text-secondary">Nombre</dt>
              <dd className="text-body-secondary font-medium text-text-primary">
                {session.user.name ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-body-secondary text-text-secondary">Correo</dt>
              <dd className="text-body-secondary font-medium text-text-primary">
                {session.user.email ?? "—"}
              </dd>
            </div>
            <div className="flex items-center justify-between py-2.5">
              <dt className="text-body-secondary text-text-secondary">Rol</dt>
              <dd className="text-body-secondary font-medium text-text-primary">
                {ETIQUETAS_ROL[session.user.rol] ?? session.user.rol}
              </dd>
            </div>
            {profesionLabel && (
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-body-secondary text-text-secondary">Profesión</dt>
                <dd className="text-body-secondary font-medium text-text-primary">
                  {profesionLabel}
                </dd>
              </div>
            )}
          </dl>
        </Card>
      </section>

      <p className="mt-6 text-caption text-text-faint">
        Notificaciones, seguridad y datos de la organización todavía no
        tienen una pantalla propia — se agregan aquí cuando se decida su
        alcance.
      </p>
    </main>
  );
}

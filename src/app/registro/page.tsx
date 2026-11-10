import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { registrarMedicoAction } from "@/app/registro/actions";
import { PROFESIONES, LABEL_PROFESION } from "@/modules/onboarding/profesiones";
import { ESPECIALIDADES_MEDICAS } from "@/modules/consultas/plantillasEspecialidad";
import { MODALIDADES_ATENCION, LABEL_MODALIDAD } from "@/modules/onboarding/modalidades";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { DIAS_SEMANA } from "@/modules/onboarding/horarioSede";

const MENSAJES_ERROR: Record<string, string> = {
  datos_invalidos: "Revisa los datos: hay campos vacíos o inválidos (la contraseña necesita al menos 8 caracteres).",
  email_registrado: "Ya existe una cuenta con ese correo.",
  profesion_otra_requerida: 'Falta especificar tu profesión cuando eliges "Otra".',
  modalidad_requerida: "Marca al menos una forma en la que atiendes (presencial, a domicilio u online).",
  sede_requerida: "Agrega al menos una sede si atiendes de forma presencial.",
  zona_requerida: "Elige al menos un municipio de cobertura si atiendes a domicilio.",
};

/**
 * Registro self-service (ver changelog punto 49, Bloque 3): una sola
 * página, sin JavaScript de cliente — mismo criterio que el resto de la
 * app (ver `CamposDescuento` en /caja). Las secciones condicionales
 * (MPPS solo si profesión = Médico, sedes solo si presencial, zonas solo
 * si domicilio) se explican con una nota en vez de ocultarse con JS: la
 * validación real vive en el servidor (`registrarMedico`).
 */
function HorarioSedeFields({ prefijoSede }: { prefijoSede: string }) {
  return (
    <details className="rounded-input border border-border px-3 py-2">
      <summary className="cursor-pointer text-sm text-text-secondary">
        + Horario de atención (opcional)
      </summary>
      <div className="mt-3 space-y-2">
        {DIAS_SEMANA.map((dia) => (
          <div key={dia} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
            <label className="flex items-center gap-1.5 text-text-primary">
              <input type="checkbox" name={`${prefijoSede}_${dia}_atiende`} />
              {dia}
            </label>
            <input
              type="time"
              name={`${prefijoSede}_${dia}_horaInicio`}
              className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
            />
            <input
              type="time"
              name={`${prefijoSede}_${dia}_horaFin`}
              className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
            />
          </div>
        ))}
      </div>
    </details>
  );
}

function SedeFields({ numero, requerida }: { numero: number; requerida?: boolean }) {
  const prefijo = `sede${numero}`;
  return (
    <div className="space-y-3 rounded-input border border-border p-3">
      <p className="text-sm font-semibold text-text-primary">
        Sede {numero}
        {!requerida && <span className="ml-1 text-text-faint">(opcional)</span>}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${prefijo}_municipio`} className="mb-1 block text-sm text-text-primary">
            Municipio
          </label>
          <select
            id={`${prefijo}_municipio`}
            name={`${prefijo}_municipio`}
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          >
            <option value="">— Selecciona —</option>
            {MUNICIPIOS_TRUJILLO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${prefijo}_telefono`} className="mb-1 block text-sm text-text-primary">
            Teléfono (opcional)
          </label>
          <Input id={`${prefijo}_telefono`} name={`${prefijo}_telefono`} />
        </div>
      </div>
      <div>
        <label htmlFor={`${prefijo}_direccion`} className="mb-1 block text-sm text-text-primary">
          Dirección
        </label>
        <Input id={`${prefijo}_direccion`} name={`${prefijo}_direccion`} />
      </div>
      <div>
        <label htmlFor={`${prefijo}_referencia`} className="mb-1 block text-sm text-text-primary">
          Referencia (opcional)
        </label>
        <Input id={`${prefijo}_referencia`} name={`${prefijo}_referencia`} />
      </div>
      <HorarioSedeFields prefijoSede={prefijo} />
    </div>
  );
}

export default async function RegistroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <Wordmark className="text-display" />
      <p className="mt-2 text-sm text-text-secondary">
        Crea tu cuenta — tu consulta privada en CONXULTY.
      </p>

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{MENSAJES_ERROR[error] ?? "Ocurrió un error."}</Alert>
        </div>
      )}

      <form action={registrarMedicoAction} className="mt-6 space-y-6">
        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">Tú</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="nombre" className="mb-1 block text-sm text-text-primary">
                Nombre completo
              </label>
              <Input id="nombre" name="nombre" required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm text-text-primary">
                  Correo
                </label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm text-text-primary">
                  Contraseña
                </label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
            </div>
            <div>
              <label htmlFor="profesion" className="mb-1 block text-sm text-text-primary">
                Profesión
              </label>
              <select
                id="profesion"
                name="profesion"
                defaultValue="MEDICO"
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {PROFESIONES.map((p) => (
                  <option key={p} value={p}>
                    {LABEL_PROFESION[p]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="profesionOtraTexto" className="mb-1 block text-sm text-text-primary">
                Si elegiste &quot;Otra&quot;, ¿cuál?
              </label>
              <Input id="profesionOtraTexto" name="profesionOtraTexto" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="especialidadMedico" className="mb-1 block text-sm text-text-primary">
                  Especialidad (si eres Médico)
                </label>
                <select
                  id="especialidadMedico"
                  name="especialidadMedico"
                  defaultValue=""
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="">— Selecciona —</option>
                  {ESPECIALIDADES_MEDICAS.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="especialidadOtra" className="mb-1 block text-sm text-text-primary">
                  Especialidad (si eres Odontólogo, Psicólogo u Otra)
                </label>
                <Input id="especialidadOtra" name="especialidadOtra" placeholder="Ej.: Ortodoncia" />
              </div>
            </div>
            <div>
              <label htmlFor="especialidadSecundaria1" className="mb-1 block text-sm text-text-primary">
                Especialidad secundaria (opcional)
              </label>
              <Input id="especialidadSecundaria1" name="especialidadSecundaria1" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label htmlFor="cedula" className="mb-1 block text-sm text-text-primary">
                  Cédula
                </label>
                <Input id="cedula" name="cedula" />
              </div>
              <div>
                <label htmlFor="numeroMpps" className="mb-1 block text-sm text-text-primary">
                  N.º de MPPS
                </label>
                <Input id="numeroMpps" name="numeroMpps" />
                <p className="mt-1 text-caption text-text-faint">
                  Solo si eres Médico. No se publica en tu ficha, solo lo usa el equipo para verificar tu matrícula.
                </p>
              </div>
              <div>
                <label htmlFor="numeroColegiado" className="mb-1 block text-sm text-text-primary">
                  N.º de colegiado
                </label>
                <Input id="numeroColegiado" name="numeroColegiado" />
              </div>
            </div>
          </div>
        </Card>

        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">¿Cómo atiendes?</h2>
          <p className="mt-1 text-caption text-text-secondary">
            Marca todas las que apliquen.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            {MODALIDADES_ATENCION.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm text-text-primary">
                <input type="checkbox" name={`modalidad_${m}`} />
                {LABEL_MODALIDAD[m]}
              </label>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            <SedeFields numero={1} requerida />
            <details className="group rounded-input border border-dashed border-border p-3">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-button border border-brand-primary px-4 py-2 text-body-secondary font-semibold text-brand-primary hover:bg-brand-primary-soft [&::-webkit-details-marker]:hidden">
                + Agregar sede
              </summary>
              <div className="mt-3 space-y-3">
                <SedeFields numero={2} />
                <details className="group rounded-input border border-dashed border-border p-3">
                  <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-button border border-brand-primary px-4 py-2 text-body-secondary font-semibold text-brand-primary hover:bg-brand-primary-soft [&::-webkit-details-marker]:hidden">
                    + Agregar otra sede
                  </summary>
                  <div className="mt-3">
                    <SedeFields numero={3} />
                  </div>
                </details>
              </div>
            </details>
          </div>
          <p className="mt-2 text-caption text-text-faint">
            Llena al menos la Sede 1 si marcaste &quot;Presencial en consultorio&quot;.
          </p>

          <div className="mt-4">
            <label htmlFor="zonasCobertura" className="mb-1 block text-sm text-text-primary">
              Zonas de cobertura a domicilio (si marcaste &quot;A domicilio&quot;)
            </label>
            <select
              id="zonasCobertura"
              name="zonasCobertura"
              multiple
              size={8}
              className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            >
              {MUNICIPIOS_TRUJILLO.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <p className="mt-1 text-caption text-text-faint">
              Mantén Ctrl (o Cmd) presionado para elegir varios.
            </p>
          </div>

          {/* 10-nov-2026: faltaba acá — se pedían zonas de cobertura para
              domicilio pero nunca la disponibilidad, así que quedaba
              huérfana hasta que el médico entraba manualmente a "Mi ficha
              pública" a completarla (mismo campo, ver FichaPublicaForm.tsx).
              Opcional, igual que ahí. */}
          <div className="mt-4">
            <label htmlFor="disponibilidad" className="mb-1 block text-sm text-text-primary">
              Disponibilidad (si marcaste &quot;A domicilio&quot;)
            </label>
            <Input
              id="disponibilidad"
              name="disponibilidad"
              placeholder="Ej.: lunes a viernes, tardes"
            />
          </div>
        </Card>

        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">Plan</h2>
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input type="radio" name="planElegido" value="FICHA" defaultChecked />
              <span>
                <strong>Ficha</strong> — listado en el Directorio.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input type="radio" name="planElegido" value="PRO" />
              <span>
                <strong>Pro</strong> — Agenda, Pacientes, Caja y el resto del software.
              </span>
            </label>
            <p className="text-caption text-text-faint">
              Pro solo aplica para Médico, Odontólogo o Psicólogo — si tu profesión es otra, tu
              cuenta queda en Ficha aunque elijas Pro.
            </p>
          </div>
        </Card>

        <Button type="submit" fullWidth size="lg">
          Crear mi cuenta
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        ¿Ya tienes cuenta? <a href="/login" className="text-brand-primary">Inicia sesión</a>
      </p>
      <p className="mt-2 text-center text-sm text-text-secondary">
        ¿Vienes a registrar una clínica o farmacia?{" "}
        <a href="/registro/entidad" className="text-brand-primary">Regístrala aquí</a>
      </p>

      <div className="mt-6">
        <VibraSignature className="text-center" />
      </div>
    </main>
  );
}

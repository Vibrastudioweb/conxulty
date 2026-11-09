import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { registrarEntidadAction } from "@/app/registro/entidad/actions";
import { TIPOS_ENTIDAD, LABEL_TIPO_ENTIDAD, type TipoEntidadId } from "@/modules/onboarding/tiposEntidad";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { DIAS_SEMANA } from "@/modules/onboarding/horarioSede";

const MENSAJES_ERROR: Record<string, string> = {
  datos_invalidos: "Revisa los datos: hay campos vacíos o inválidos (la contraseña necesita al menos 8 caracteres).",
  email_registrado: "Ya existe una cuenta con ese correo.",
};

function esTipoValido(valor: string | undefined): valor is TipoEntidadId {
  return !!valor && (TIPOS_ENTIDAD as readonly string[]).includes(valor);
}

/**
 * Registro self-service de clínica/farmacia — ver changelog punto 90/92.
 * Mismo criterio sin JavaScript de cliente que /registro (médico): la
 * validación real vive en el servidor (`registrarEntidad`). Sin
 * profesión/modalidades/sedes/plan — una entidad tiene una sola ubicación
 * y no elige Plan (gratis por ahora).
 */
export default async function RegistroEntidadPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; error?: string }>;
}) {
  const { tipo, error } = await searchParams;
  const tipoInicial: TipoEntidadId = esTipoValido(tipo) ? tipo : "CLINICA";

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-4 py-10">
      <Wordmark className="text-display" />
      <p className="mt-2 text-sm text-text-secondary">
        Registra tu clínica o farmacia en CONXULTY — gratis.
      </p>

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{MENSAJES_ERROR[error] ?? "Ocurrió un error."}</Alert>
        </div>
      )}

      <form action={registrarEntidadAction} className="mt-6 space-y-6">
        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">Tu centro</h2>
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="tipo" className="mb-1 block text-sm text-text-primary">
                Tipo
              </label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={tipoInicial}
                className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              >
                {TIPOS_ENTIDAD.map((t) => (
                  <option key={t} value={t}>
                    {LABEL_TIPO_ENTIDAD[t]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="nombre" className="mb-1 block text-sm text-text-primary">
                Nombre del centro
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
          </div>
        </Card>

        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">Ubicación y contacto</h2>
          <div className="mt-3 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="municipio" className="mb-1 block text-sm text-text-primary">
                  Municipio
                </label>
                <select
                  id="municipio"
                  name="municipio"
                  defaultValue=""
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
                <label htmlFor="telefono" className="mb-1 block text-sm text-text-primary">
                  Teléfono
                </label>
                <Input id="telefono" name="telefono" />
              </div>
            </div>
            <div>
              <label htmlFor="direccion" className="mb-1 block text-sm text-text-primary">
                Dirección
              </label>
              <Input id="direccion" name="direccion" />
            </div>
          </div>
        </Card>

        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">Horario de atención</h2>
          <details className="mt-3 rounded-input border border-border px-3 py-2">
            <summary className="cursor-pointer text-sm text-text-secondary">+ Días y horas (opcional)</summary>
            <div className="mt-3 space-y-2">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
                  <label className="flex items-center gap-1.5 text-text-primary">
                    <input type="checkbox" name={`horario_${dia}_atiende`} />
                    {dia}
                  </label>
                  <input
                    type="time"
                    name={`horario_${dia}_horaInicio`}
                    className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
                  />
                  <input
                    type="time"
                    name={`horario_${dia}_horaFin`}
                    className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
                  />
                </div>
              ))}
            </div>
          </details>
        </Card>

        <Button type="submit" fullWidth size="lg">
          Crear mi cuenta
        </Button>
      </form>

      <p className="mt-4 text-center text-sm text-text-secondary">
        ¿Ya tienes cuenta? <a href="/login" className="text-brand-primary">Inicia sesión</a>
      </p>

      <div className="mt-6">
        <VibraSignature className="text-center" />
      </div>
    </main>
  );
}

import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { registrarMedicoAction } from "@/app/registro/actions";
import { PROFESIONES, LABEL_PROFESION } from "@/modules/onboarding/profesiones";

const MENSAJES_ERROR: Record<string, string> = {
  datos_invalidos: "Revisa los datos: hay campos vacíos o inválidos (la contraseña necesita al menos 8 caracteres).",
  email_registrado: "Ya existe una cuenta con ese correo.",
  profesion_otra_requerida: 'Falta especificar tu profesión cuando eliges "Otra".',
};

/**
 * Registro self-service (ver changelog punto 49, Bloque 3): una sola
 * página, sin JavaScript de cliente — mismo criterio que el resto de la
 * app (ver `CamposDescuento` en /caja).
 *
 * 10-nov-2026, pedido del usuario ("quiero hacer súper sencillo el
 * registro inicial y poner todo lo demás en mi ficha"): especialidad,
 * modalidad (cómo atiendes) y sedes/horario se sacaron de esta pantalla
 * — antes vivían acá (con "Presencial" bloqueando sin al menos una sede
 * cargada) y ahora se completan después en "Mi ficha pública"
 * (FichaPublicaForm.tsx), que ya tiene su propio CRUD para todo eso y su
 * propia validación antes de publicar. El registro queda en lo mínimo
 * para tener cuenta: quién sos, con qué entrás, tu profesión y tu plan.
 */
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
            {/* 10-nov-2026, pedido del usuario ("quiero hacer súper sencillo el
                registro inicial y poner todo lo demás en mi ficha"):
                especialidad, especialidad secundaria, cédula, MPPS, colegiado,
                modalidad y sedes/horario se sacaron de acá — se llenan
                después en "Mi ficha pública" (FichaPublicaForm.tsx), no
                bloquean crear la cuenta. */}
          </div>
        </Card>

        <Card padding="spacious">
          <h2 className="text-sm font-semibold text-text-primary">Plan</h2>
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input type="radio" name="planElegido" value="FICHA" defaultChecked />
              <span>
                <strong>Ficha</strong> — $5/mes, primer mes gratis. Tu ficha pública en
                el Directorio, agenda de citas y tus pacientes.
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-text-primary">
              <input type="radio" name="planElegido" value="PRO" />
              <span>
                <strong>Pro</strong> — $20/mes, sin mes gratis. Todo lo de Ficha, más
                consultas y notas clínicas, recetas, caja y reportes.
              </span>
            </label>
            <p className="text-caption text-text-faint">
              Tu cuenta empieza en Ficha con el primer mes gratis. Si eliges Pro, al
              terminar el registro te mostramos cómo pagarlo.
            </p>
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

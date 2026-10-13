import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { crearSolicitudAcceso } from "@/modules/solicitudes";

export const metadata = {
  title: "Solicita tu acceso — Conxulty",
};

function texto(formData: FormData, campo: string) {
  const v = formData.get(campo);
  return typeof v === "string" ? v : "";
}

async function enviarSolicitud(formData: FormData) {
  "use server";

  const h = await headers();
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    "desconocida";

  const resultado = await crearSolicitudAcceso(
    {
      nombre: texto(formData, "nombre"),
      email: texto(formData, "email"),
      telefono: texto(formData, "telefono"),
      especialidad: texto(formData, "especialidad") || undefined,
      nombreConsultorio: texto(formData, "nombreConsultorio"),
    },
    { ip, honeypot: texto(formData, "sitioWeb") },
  );

  if (resultado.estado === "invalida") redirect("/solicitar-acceso?error=datos");
  if (resultado.estado === "limite") redirect("/solicitar-acceso?error=limite");
  redirect("/solicitar-acceso?ok=1");
}

export default async function SolicitarAccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { ok, error } = await searchParams;
  const etiqueta = "mb-1 block text-sm font-medium text-text-primary";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Card padding="spacious" elevated className="w-full max-w-md">
        <Wordmark className="text-display" />

        {ok ? (
          <div className="mt-6 space-y-3">
            <Alert tone="success" title="¡Solicitud recibida!">
              Revisamos cada solicitud personalmente. Te contactaremos pronto
              para activar tu acceso.
            </Alert>
          </div>
        ) : (
          <>
            <h1 className="mt-4 font-display text-page-title font-semibold text-text-primary">
              Solicita tu acceso
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              Cuéntanos sobre tu consultorio. Activamos las cuentas
              manualmente y te escribimos por WhatsApp o correo.
            </p>

            <form action={enviarSolicitud} className="mt-6 space-y-4">
              <div>
                <label htmlFor="nombre" className={etiqueta}>
                  Tu nombre
                </label>
                <Input id="nombre" name="nombre" autoComplete="name" required minLength={2} maxLength={120} />
              </div>
              <div>
                <label htmlFor="nombreConsultorio" className={etiqueta}>
                  Nombre del consultorio
                </label>
                <Input id="nombreConsultorio" name="nombreConsultorio" required minLength={2} maxLength={160} />
              </div>
              <div>
                <label htmlFor="email" className={etiqueta}>
                  Correo
                </label>
                <Input id="email" name="email" type="email" autoComplete="email" required maxLength={160} />
              </div>
              <div>
                <label htmlFor="telefono" className={etiqueta}>
                  Teléfono / WhatsApp
                </label>
                <Input id="telefono" name="telefono" type="tel" autoComplete="tel" required minLength={6} maxLength={30} />
              </div>
              <div>
                <label htmlFor="especialidad" className={etiqueta}>
                  Especialidad <span className="text-text-secondary">(opcional)</span>
                </label>
                <Input id="especialidad" name="especialidad" maxLength={120} />
              </div>

              {/* Honeypot: oculto para personas, los bots lo llenan. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="sitioWeb">No llenar</label>
                <input id="sitioWeb" name="sitioWeb" type="text" tabIndex={-1} autoComplete="off" />
              </div>

              {error === "datos" && (
                <Alert tone="danger">
                  Revisa los datos: hay campos incompletos o con formato inválido.
                </Alert>
              )}
              {error === "limite" && (
                <Alert tone="warning">
                  Demasiados intentos. Espera unos minutos e inténtalo de nuevo.
                </Alert>
              )}

              <Button type="submit" fullWidth>
                Solicitar acceso
              </Button>
            </form>
          </>
        )}
      </Card>

      <div className="mt-6">
        <VibraSignature className="text-center" />
      </div>
    </main>
  );
}

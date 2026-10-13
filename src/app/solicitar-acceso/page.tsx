import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { solicitarAccesoAction } from "./actions";

export const metadata = { title: "Solicita tu acceso — Conxulty" };

const LABEL = "mb-1 block text-sm font-medium text-text-primary";

export default async function SolicitarAccesoPage({
  searchParams,
}: {
  searchParams: Promise<{ enviada?: string; error?: string }>;
}) {
  const { enviada, error } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <Card padding="spacious" elevated className="w-full max-w-md">
        <Wordmark className="text-display" />
        <h1 className="mt-4 font-display text-page-title font-semibold text-text-primary">
          Solicita tu acceso
        </h1>

        {enviada ? (
          <div className="mt-6 space-y-4">
            <Alert tone="success" title="Solicitud recibida">
              Te contactaremos pronto para activar tu cuenta.
            </Alert>
            <Link
              href="/login"
              className="inline-block text-sm text-brand-primary underline"
            >
              Ir a iniciar sesión
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm text-text-secondary">
              Déjanos tus datos y activaremos tu cuenta personalmente.
            </p>

            <form action={solicitarAccesoAction} className="mt-6 space-y-4">
              <div>
                <label htmlFor="nombre" className={LABEL}>
                  Nombre del médico *
                </label>
                <Input id="nombre" name="nombre" required maxLength={120} autoComplete="name" />
              </div>
              <div>
                <label htmlFor="nombreConsultorio" className={LABEL}>
                  Nombre del consultorio *
                </label>
                <Input id="nombreConsultorio" name="nombreConsultorio" required maxLength={160} />
              </div>
              <div>
                <label htmlFor="email" className={LABEL}>
                  Correo *
                </label>
                <Input id="email" name="email" type="email" required maxLength={160} autoComplete="email" />
              </div>
              <div>
                <label htmlFor="telefono" className={LABEL}>
                  Teléfono *
                </label>
                <Input id="telefono" name="telefono" type="tel" required minLength={6} maxLength={30} autoComplete="tel" />
              </div>
              <div>
                <label htmlFor="especialidad" className={LABEL}>
                  Especialidad
                </label>
                <Input id="especialidad" name="especialidad" maxLength={120} />
              </div>

              {/* Honeypot anti-bots: oculto a personas y a lectores de pantalla. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label htmlFor="sitioWeb">No completar</label>
                <input id="sitioWeb" name="sitioWeb" tabIndex={-1} autoComplete="off" />
              </div>

              {error && (
                <Alert tone="danger">
                  Revisa los datos: hay campos vacíos o con formato inválido.
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

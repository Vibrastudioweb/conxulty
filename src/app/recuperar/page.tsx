import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { recuperarAction } from "./actions";

export const metadata = { title: "Recuperar contraseña — CONXULTY" };

/**
 * "Olvidé mi contraseña" (10-nov-2026, pedido del usuario: "falta olvide
 * usuario y olvide contraseña" en /login). El login es por correo — no hay
 * un "usuario" separado que recuperar, ver comentario en recuperacion.ts.
 *
 * Mismo mensaje de éxito exista o no la cuenta (?enviado=1) — nunca se
 * confirma ni se desmiente si un correo está registrado.
 */
export default async function RecuperarPage({
  searchParams,
}: {
  searchParams: Promise<{ enviado?: string }>;
}) {
  const { enviado } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card padding="spacious" elevated className="w-full max-w-sm">
        <Wordmark className="text-display" />
        <p className="mt-2 text-sm text-text-secondary">Recupera tu contraseña</p>

        {enviado ? (
          <div className="mt-4">
            <Alert tone="success" title="Revisa tu correo">
              Si ese correo tiene una cuenta, te mandamos un link para elegir una contraseña nueva. Vence en 1 hora.
            </Alert>
          </div>
        ) : (
          <form action={recuperarAction} className="mt-6 space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
                Correo
              </label>
              <Input id="email" name="email" type="email" required />
            </div>
            <Button type="submit" fullWidth>
              Mandar link de recuperación
            </Button>
          </form>
        )}
      </Card>

      <p className="mt-4 text-center text-sm text-text-secondary">
        <a href="/login" className="text-brand-primary">
          Volver a iniciar sesión
        </a>
      </p>

      <div className="mt-6">
        <VibraSignature className="text-center" />
      </div>
    </main>
  );
}

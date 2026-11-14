import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { accesoBloqueado } from "@/modules/acceso/intentos";
import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { BotonDescargarApp } from "@/components/pwa/BotonDescargarApp";

async function autenticar(formData: FormData) {
  "use server";

  // El bloqueo de verdad vive en `authorize` (auth/index.ts); esta consulta
  // previa es solo para poder decirle a la persona POR QUÉ no entra, en vez
  // del "correo o contraseña incorrectos" de siempre.
  if (await accesoBloqueado(String(formData.get("email") ?? ""))) {
    redirect("/login?error=bloqueado");
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login?error=1");
    }
    throw error;
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; creada?: string; restablecida?: string }>;
}) {
  const { error, creada, restablecida } = await searchParams;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card padding="spacious" elevated className="w-full max-w-sm">
        <Wordmark className="text-display" />
        <p className="mt-2 text-sm text-text-secondary">
          Inicia sesión para continuar
        </p>

        {creada && (
          <div className="mt-4">
            <Alert tone="success">
              Tu cuenta se creó correctamente — inicia sesión con tu correo y contraseña.
            </Alert>
          </div>
        )}
        {restablecida && (
          <div className="mt-4">
            <Alert tone="success">Tu contraseña quedó actualizada — inicia sesión con la nueva.</Alert>
          </div>
        )}

        <form action={autenticar} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Correo
            </label>
            <Input id="email" name="email" type="email" required />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Contraseña
            </label>
            <Input id="password" name="password" type="password" required />
          </div>

          {error === "bloqueado" ? (
            <Alert tone="danger">
              Demasiados intentos fallidos. Espera 15 minutos o restablece tu contraseña desde
              “¿Olvidaste tu contraseña?”.
            </Alert>
          ) : (
            error && <Alert tone="danger">Correo o contraseña incorrectos.</Alert>
          )}

          <Button type="submit" fullWidth>
            Iniciar sesión
          </Button>
        </form>

        {/* 10-nov-2026, pedido del usuario ("falta olvide usuario y olvide
            contraseña"): el login es por correo — no hay un "usuario"
            aparte que se pueda olvidar (ver Usuario.email @unique), así
            que solo se agrega recuperación de contraseña. */}
        <p className="mt-3 text-center text-sm">
          <a href="/recuperar" className="text-brand-primary">
            ¿Olvidaste tu contraseña?
          </a>
        </p>
      </Card>

      <p className="mt-4 text-center text-sm text-text-secondary">
        ¿No tienes cuenta? <a href="/registro" className="text-brand-primary">Regístrate</a>
      </p>

      {/* 14-nov-2026, pedido puntual del usuario: "en el login debe estar
          también" el botón de instalar la app (equivalente al de
          conxulty.com para pacientes, repo vitalud). Secundario a propósito
          — iniciar sesión sigue siendo la acción principal de esta
          pantalla. */}
      <div className="mt-4 flex justify-center">
        <BotonDescargarApp />
      </div>

      <div className="mt-6">
        <VibraSignature className="text-center" />
      </div>
    </main>
  );
}

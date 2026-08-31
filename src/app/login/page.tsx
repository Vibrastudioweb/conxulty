import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { Wordmark } from "@/components/ui/Wordmark";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

async function autenticar(formData: FormData) {
  "use server";

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
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card padding="spacious" elevated className="w-full max-w-sm">
        <Wordmark className="text-2xl" />
        <p className="mt-2 text-sm text-text-secondary">
          Inicia sesión para continuar
        </p>

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

          {error && <Alert tone="danger">Correo o contraseña incorrectos.</Alert>}

          <Button type="submit" fullWidth>
            Iniciar sesión
          </Button>
        </form>
      </Card>
    </main>
  );
}

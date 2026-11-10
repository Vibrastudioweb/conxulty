import { Wordmark } from "@/components/brand/Wordmark";
import { VibraSignature } from "@/components/brand/VibraSignature";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { tokenRecuperacionValido } from "@/modules/acceso/recuperacion";
import { restablecerAction } from "./actions";

export const metadata = { title: "Restablecer contraseña — CONXULTY" };

const MENSAJES_ERROR: Record<string, string> = {
  corta: "La contraseña debe tener al menos 8 caracteres.",
  no_coincide: "Las contraseñas no coinciden.",
  vencido: "Este link ya venció o ya se usó.",
};

export default async function RestablecerPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;
  const valido = token ? await tokenRecuperacionValido(token) : false;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <Card padding="spacious" elevated className="w-full max-w-sm">
        <Wordmark className="text-display" />
        <p className="mt-2 text-sm text-text-secondary">Elige tu contraseña nueva</p>

        {!token || !valido ? (
          <div className="mt-4 space-y-3">
            <Alert tone="danger" title="Link vencido o inválido">
              {error ? MENSAJES_ERROR[error] ?? "Este link ya no sirve." : "Este link ya no sirve."} Pide uno nuevo.
            </Alert>
            <a
              href="/recuperar"
              className="flex w-full items-center justify-center rounded-button bg-brand-primary px-4 py-2 text-body-secondary font-medium text-white hover:bg-brand-primary-hover"
            >
              Pedir un link nuevo
            </a>
          </div>
        ) : (
          <form action={restablecerAction} className="mt-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            {error && <Alert tone="danger">{MENSAJES_ERROR[error] ?? "Ocurrió un error."}</Alert>}
            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-primary">
                Contraseña nueva
              </label>
              <Input id="password" name="password" type="password" minLength={8} required />
            </div>
            <div>
              <label htmlFor="confirmarPassword" className="mb-1 block text-sm font-medium text-text-primary">
                Confirmar contraseña
              </label>
              <Input id="confirmarPassword" name="confirmarPassword" type="password" minLength={8} required />
            </div>
            <Button type="submit" fullWidth>
              Guardar contraseña nueva
            </Button>
          </form>
        )}
      </Card>

      <div className="mt-6">
        <VibraSignature className="text-center" />
      </div>
    </main>
  );
}

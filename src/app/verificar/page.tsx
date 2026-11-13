import Link from "next/link";
import { verificarConToken } from "@/modules/acceso/verificacionEmail";

/**
 * Donde aterriza el enlace del correo de confirmación.
 *
 * Pública a propósito: el médico puede abrir el correo en el teléfono sin
 * la sesión iniciada, y pedirle que entre primero sería perder justo al
 * que estamos tratando de confirmar. El token es la credencial.
 */
export const dynamic = "force-dynamic";

const MENSAJES = {
  verificado: {
    titulo: "Listo, tu correo quedó confirmado",
    detalle:
      "Ya puedes publicar tu ficha en el directorio, y si alguna vez olvidas tu contraseña podremos ayudarte a recuperarla.",
    tono: "bien" as const,
  },
  "ya-estaba": {
    titulo: "Este correo ya estaba confirmado",
    detalle: "No tienes que hacer nada más.",
    tono: "bien" as const,
  },
  vencido: {
    titulo: "Este enlace venció",
    detalle:
      "Los enlaces duran 48 horas. Entra a tu cuenta y pide uno nuevo desde el aviso que verás arriba.",
    tono: "mal" as const,
  },
  invalido: {
    titulo: "Este enlace no sirve",
    detalle:
      "Puede que ya lo hayas usado o que esté incompleto. Entra a tu cuenta y pide uno nuevo desde el aviso que verás arriba.",
    tono: "mal" as const,
  },
};

export default async function VerificarPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const resultado = await verificarConToken(token ?? "");
  const mensaje = MENSAJES[resultado];

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-card border border-border bg-surface p-6">
        <h1
          className={`text-heading-3 ${mensaje.tono === "bien" ? "text-text-primary" : "text-amber-900"}`}
        >
          {mensaje.titulo}
        </h1>
        <p className="mt-2 text-body-secondary text-text-secondary">{mensaje.detalle}</p>
        <Link
          href="/hoy"
          className="mt-6 inline-flex min-h-touch items-center rounded-input bg-primary px-4 text-body font-semibold text-on-primary"
        >
          Ir a mi cuenta
        </Link>
      </div>
    </main>
  );
}

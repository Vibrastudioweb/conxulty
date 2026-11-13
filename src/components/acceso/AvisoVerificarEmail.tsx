import { prisma } from "@/db/client";
import { reenviarVerificacionAction } from "@/app/(dashboard)/verificacionActions";

/**
 * Aviso dentro del OS para quien no confirmó su correo (13-nov-2026).
 *
 * No bloquea nada de lo que el médico vino a hacer: puede usar el producto
 * completo. Lo único atado a confirmar es publicar la ficha en el
 * Directorio, que es donde un correo al que no llegamos sí importa.
 *
 * El texto dice qué se pierde, no qué está mal: "no vas a poder recuperar
 * tu contraseña" le explica por qué le conviene a él, en vez de sonar a
 * trámite nuestro.
 */
export async function AvisoVerificarEmail({ usuarioId }: { usuarioId: string }) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { emailVerificado: true, email: true },
  });
  if (!usuario || usuario.emailVerificado) return null;

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-body-secondary text-amber-900 lg:px-8">
      Te mandamos un correo a <strong>{usuario.email}</strong> para confirmar que es tuyo.
      Hasta que lo confirmes no puedes publicar tu ficha en el directorio, ni recuperar tu
      contraseña si la olvidas.{" "}
      <form action={reenviarVerificacionAction} className="inline">
        <button type="submit" className="font-semibold underline">
          Reenviar
        </button>
      </form>
    </div>
  );
}

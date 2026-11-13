import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { listarResenasPendientes } from "@/modules/directorio/resenas";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { moderarResenaAction } from "./actions";

export const metadata = { title: "Reseñas — CONXULTY" };

export default async function ResenasPage() {
  const { session } = await requireMedicoSesion();

  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: { fichaDirectorioId: true },
  });

  if (!organizacion.fichaDirectorioId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
        <h1 className="text-h2 font-semibold text-text-primary">Reseñas</h1>
        <div className="mt-4">
          <Alert tone="info" title="Todavía no tienes ficha pública">
            Las reseñas viven en tu ficha del Directorio — completa
            &quot;Mi ficha pública&quot; primero.
          </Alert>
        </div>
      </div>
    );
  }

  const resultado = await listarResenasPendientes(organizacion.fichaDirectorioId);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 lg:px-8">
      <h1 className="text-h2 font-semibold text-text-primary">Reseñas</h1>
      <p className="mt-1 text-sm text-text-secondary">
        Las reseñas de 4 y 5 estrellas se publican solas en tu ficha
        pública. Las de 1 a 3 estrellas quedan acá, esperando tu decisión
        — nadie más las ve hasta que las aprobás.
      </p>

      {!resultado.ok && (
        <div className="mt-4">
          <Alert tone="danger" title="No se pudo cargar el Directorio ahora">
            {resultado.error}
          </Alert>
        </div>
      )}

      {resultado.ok && resultado.pendientes.length === 0 && (
        <div className="mt-4">
          <Alert tone="success" title="Sin reseñas pendientes">
            No tienes ninguna reseña esperando revisión por ahora.
          </Alert>
        </div>
      )}

      {resultado.ok && resultado.pendientes.length > 0 && (
        <div className="mt-6 flex flex-col gap-3">
          {resultado.pendientes.map((resena) => (
            <Card key={resena.id} padding="compact">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-text-primary">{resena.nombre}</p>
                  <p className="text-caption text-text-secondary">{resena.telefono}</p>
                </div>
                <span className="shrink-0 text-amber-500">
                  {"★".repeat(resena.estrellas)}
                  {"☆".repeat(5 - resena.estrellas)}
                </span>
              </div>
              {resena.comentario && (
                <p className="mt-2 text-body-secondary text-text-secondary">{resena.comentario}</p>
              )}
              <div className="mt-3 flex gap-2">
                <form action={moderarResenaAction}>
                  <input type="hidden" name="resenaId" value={resena.id} />
                  <input type="hidden" name="decision" value="publicar" />
                  <button
                    type="submit"
                    className="rounded-button bg-success-soft px-3 py-1.5 text-caption font-semibold text-success-text transition hover:opacity-80"
                  >
                    Publicar
                  </button>
                </form>
                <form action={moderarResenaAction}>
                  <input type="hidden" name="resenaId" value={resena.id} />
                  <input type="hidden" name="decision" value="rechazar" />
                  <button
                    type="submit"
                    className="rounded-button bg-danger-soft px-3 py-1.5 text-caption font-semibold text-danger-text transition hover:opacity-80"
                  >
                    Rechazar
                  </button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

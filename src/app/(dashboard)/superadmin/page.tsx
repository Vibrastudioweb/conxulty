import Link from "next/link";
import type { EstadoSolicitudAcceso } from "@prisma/client";
import { requireSuperadmin } from "@/modules/core/autorizacion";
import { listarSolicitudes } from "@/modules/acceso/solicitudes";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { marcarContactadoAction, rechazarSolicitudAction } from "./actions";

const TONO_ESTADO: Record<EstadoSolicitudAcceso, BadgeTone> = {
  PENDIENTE: "warning",
  CONTACTADO: "info",
  ACTIVADO: "success",
  RECHAZADO: "neutral",
};

export default async function SuperadminPage() {
  await requireSuperadmin();
  const solicitudes = await listarSolicitudes();

  return (
    <main className="mx-auto min-h-screen max-w-3xl bg-background px-4 py-6">
      <PageHeader
        eyebrow="Súper-admin"
        title="Solicitudes de acceso"
        description="Activa manualmente a los médicos que pidieron acceso."
      />

      {solicitudes.length === 0 ? (
        <div className="mt-6">
          <EmptyState message="Aún no hay solicitudes. Cuando alguien pida acceso aparecerá aquí." />
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {solicitudes.map((s) => {
            const abierta = s.estado === "PENDIENTE" || s.estado === "CONTACTADO";
            return (
              <li key={s.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-text-primary">{s.nombre}</p>
                      <p className="text-body-secondary text-text-secondary">
                        {s.nombreConsultorio}
                        {s.especialidad ? ` · ${s.especialidad}` : ""}
                      </p>
                      <p className="text-body-secondary text-text-secondary">
                        {s.email} · {s.telefono}
                      </p>
                      <p className="text-caption text-text-faint">
                        {s.createdAt.toLocaleString("es", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    <Badge tone={TONO_ESTADO[s.estado]}>{s.estado}</Badge>
                  </div>

                  {abierta && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Link
                        href={`/superadmin/solicitudes/${s.id}/activar`}
                        className="inline-flex items-center rounded-button bg-brand-primary px-3 py-1.5 text-caption font-semibold text-white hover:bg-brand-primary-hover"
                      >
                        Activar
                      </Link>
                      {s.estado === "PENDIENTE" && (
                        <form action={marcarContactadoAction}>
                          <input type="hidden" name="solicitudId" value={s.id} />
                          <Button type="submit" size="sm" variant="secondary">
                            Marcar contactado
                          </Button>
                        </form>
                      )}
                      <form action={rechazarSolicitudAction}>
                        <input type="hidden" name="solicitudId" value={s.id} />
                        <Button type="submit" size="sm" variant="ghost">
                          Rechazar
                        </Button>
                      </form>
                    </div>
                  )}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}

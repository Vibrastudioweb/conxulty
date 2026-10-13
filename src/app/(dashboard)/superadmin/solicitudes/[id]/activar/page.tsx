import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSuperadmin } from "@/modules/core/autorizacion";
import {
  listarOrganizaciones,
  obtenerSolicitud,
} from "@/modules/acceso/solicitudes";
import { PageHeader } from "@/components/ui/PageHeader";
import { ActivarSolicitudForm } from "./ActivarSolicitudForm";

export default async function ActivarSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperadmin();
  const { id } = await params;

  const solicitud = await obtenerSolicitud(id);
  if (!solicitud) notFound();

  const organizaciones = await listarOrganizaciones();
  const activable =
    solicitud.estado === "PENDIENTE" || solicitud.estado === "CONTACTADO";

  return (
    <main className="mx-auto min-h-screen max-w-xl bg-background px-4 py-6">
      <PageHeader
        eyebrow="Súper-admin"
        title="Activar solicitud"
        description={`${solicitud.nombre} · ${solicitud.nombreConsultorio} · ${solicitud.telefono}`}
        context={
          <Link href="/superadmin" className="text-sm text-brand-primary underline">
            ← Volver a solicitudes
          </Link>
        }
      />

      <div className="mt-6">
        <ActivarSolicitudForm
          solicitudId={solicitud.id}
          nombreSugerido={solicitud.nombre}
          emailSugerido={solicitud.email}
          organizacionSugerida={solicitud.nombreConsultorio}
          organizaciones={organizaciones}
          activable={activable}
        />
      </div>
    </main>
  );
}

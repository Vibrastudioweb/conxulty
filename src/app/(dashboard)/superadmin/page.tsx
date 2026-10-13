import { requireSuperadmin } from "@/modules/core/autorizacion";
import {
  listarOrganizaciones,
  listarSolicitudes,
} from "@/modules/superadmin/solicitudes";
import { PageHeader } from "@/components/ui/PageHeader";
import { PanelSolicitudes } from "./PanelSolicitudes";

export const dynamic = "force-dynamic";

export default async function SuperadminPage() {
  await requireSuperadmin();

  const [solicitudes, organizaciones] = await Promise.all([
    listarSolicitudes(),
    listarOrganizaciones(),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <PageHeader
        eyebrow="Súper-admin"
        title="Solicitudes de acceso"
        description="Revisa a los médicos que pidieron acceso, actívalos y envíales sus credenciales."
      />

      <div className="mt-6">
        <PanelSolicitudes
          solicitudes={solicitudes.map((s) => ({
            id: s.id,
            nombre: s.nombre,
            email: s.email,
            telefono: s.telefono,
            especialidad: s.especialidad,
            nombreConsultorio: s.nombreConsultorio,
            estado: s.estado,
            createdAt: s.createdAt.toISOString(),
          }))}
          organizaciones={organizaciones}
        />
      </div>
    </main>
  );
}

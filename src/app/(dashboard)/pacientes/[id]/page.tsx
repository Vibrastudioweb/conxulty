import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMedico } from "@/modules/core/autorizacion";
import { obtenerPaciente } from "@/modules/core/pacientes";
import { obtenerCita, listarCitasDelPaciente } from "@/modules/core/citas";
import { listarConsultasDelPaciente } from "@/modules/core/consultas";
import { listarAntecedentesDelPaciente } from "@/modules/core/antecedentes";
import { listarDocumentosDelPaciente } from "@/modules/documentos/documentos";
import { listarEventosDelPaciente } from "@/modules/trazabilidad";
import { formatearFechaISO } from "@/components/citas/fecha";
import {
  iniciarConsultaAction,
  archivarPacienteAction,
  reactivarPacienteAction,
  crearAntecedenteAction,
  editarAntecedenteAction,
  desactivarAntecedenteAction,
} from "./actions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { ConsultaHistorialCard } from "@/components/consultas/ConsultaHistorialCard";
import { AlertaAlergias } from "@/components/pacientes/AlertaAlergias";
import { AntecedentesSeccion } from "@/components/pacientes/AntecedentesSeccion";
import { CitasPacienteSeccion } from "@/components/pacientes/CitasPacienteSeccion";
import { DocumentosPacienteSeccion } from "@/components/pacientes/DocumentosPacienteSeccion";
import { TrazabilidadPacienteSeccion } from "@/components/pacientes/TrazabilidadPacienteSeccion";
import { SignosVitalesCard } from "@/components/pacientes/SignosVitalesCard";
import { TratamientosPacienteSeccion } from "@/components/pacientes/TratamientosPacienteSeccion";
import { TabsFicha, type TabFicha } from "@/components/pacientes/TabsFicha";

/** Primera cita futura (PENDIENTE o CONFIRMADA), o null si no hay ninguna.
 *  `listarCitasDelPaciente` ya viene ordenada desc, así que se filtra y se
 *  reordena asc en vez de asumir alguna posición fija. */
function proximaCita<T extends { fechaHora: Date; estado: string }>(
  citas: T[],
): T | null {
  const ahora = new Date();
  const futuras = citas
    .filter(
      (c) =>
        c.fechaHora >= ahora &&
        (c.estado === "PENDIENTE" || c.estado === "CONFIRMADA"),
    )
    .sort((a, b) => a.fechaHora.getTime() - b.fechaHora.getTime());
  return futuras[0] ?? null;
}

function calcularEdad(fechaNacimiento: Date): number {
  const hoy = new Date();
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear();
  const aunNoCumple =
    hoy.getMonth() < fechaNacimiento.getMonth() ||
    (hoy.getMonth() === fechaNacimiento.getMonth() && hoy.getDate() < fechaNacimiento.getDate());
  if (aunNoCumple) edad -= 1;
  return edad;
}

const MENSAJES_EXITO: Record<string, string> = {
  actualizado: "Paciente actualizado.",
  archivado: "Paciente archivado.",
  reactivado: "Paciente reactivado.",
  antecedente_creado: "Antecedente registrado.",
  antecedente_editado: "Antecedente actualizado.",
  antecedente_desactivado: "Antecedente desactivado.",
};

export default async function PacientePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const session = await requireMedico();

  const { id } = await params;
  const { cita: citaId, error, tab: tabParam, ...resto } = await searchParams;
  const mensajeExito = Object.keys(MENSAJES_EXITO).find((clave) => clave in resto);
  const TABS_VALIDAS: TabFicha[] = [
    "resumen",
    "datos",
    "antecedentes",
    "historial",
    "tratamientos",
    "citas",
    "documentos",
    "ia",
  ];
  const tab: TabFicha = TABS_VALIDAS.includes(tabParam as TabFicha)
    ? (tabParam as TabFicha)
    : "resumen";

  const paciente = await obtenerPaciente({
    organizacionId: session.user.organizacionId,
    pacienteId: id,
  });

  if (!paciente) {
    notFound();
  }

  const cita = citaId
    ? await obtenerCita({ organizacionId: session.user.organizacionId, citaId })
    : null;

  const [consultasPrevias, citas, antecedentes, documentos, eventos] = await Promise.all([
    listarConsultasDelPaciente({
      organizacionId: session.user.organizacionId,
      pacienteId: paciente.id,
    }),
    listarCitasDelPaciente({
      organizacionId: session.user.organizacionId,
      pacienteId: paciente.id,
    }),
    listarAntecedentesDelPaciente({
      organizacionId: session.user.organizacionId,
      pacienteId: paciente.id,
    }),
    listarDocumentosDelPaciente({
      organizacionId: session.user.organizacionId,
      pacienteId: paciente.id,
    }),
    listarEventosDelPaciente({
      organizacionId: session.user.organizacionId,
      pacienteId: paciente.id,
    }),
  ]);

  const citaNoDisponible =
    cita && !cita.consulta && (cita.estado === "CANCELADA" || cita.estado === "NO_ASISTIO");
  const hoyISO = formatearFechaISO(new Date());

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 pb-16 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader
        eyebrow={paciente.activo ? undefined : "Archivado"}
        title={`${paciente.nombre} ${paciente.apellido}`}
        description={[
          paciente.fechaNacimiento ? `${calcularEdad(paciente.fechaNacimiento)} años` : null,
          paciente.sexo,
          paciente.documentoIdentidad ? `Doc. ${paciente.documentoIdentidad}` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined}
        context={
          <Link href="/pacientes" className="text-sm text-brand-primary hover:underline">
            ← Volver a Pacientes
          </Link>
        }
        secondaryActions={
          <Link
            href={`/pacientes/${paciente.id}/editar`}
            className="rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary"
          >
            Editar
          </Link>
        }
      />

      {mensajeExito && (
        <div className="mt-4">
          <Alert tone="success">{MENSAJES_EXITO[mensajeExito]}</Alert>
        </div>
      )}
      {error === "cita_no_disponible" && (
        <div className="mt-4">
          <Alert tone="danger">
            Esa cita está cancelada o marcada como no asistida: no se puede iniciar una consulta
            a partir de ella.
          </Alert>
        </div>
      )}
      {error === "antecedente_invalido" && (
        <div className="mt-4">
          <Alert tone="danger">Completa tipo y descripción del antecedente.</Alert>
        </div>
      )}
      {error === "antecedente_no_editable" && (
        <div className="mt-4">
          <Alert tone="danger">
            Ese antecedente está desactivado y ya no puede editarse.
          </Alert>
        </div>
      )}
      {error === "paciente_archivado" && (
        <div className="mt-4">
          <Alert tone="danger">
            Este paciente está archivado: reactívalo antes de iniciar una consulta nueva.
          </Alert>
        </div>
      )}

      <AlertaAlergias antecedentes={antecedentes} />

      {cita && (
        <div className="mt-4">
          <Card padding="cozy">
            <span className="text-text-secondary">
              Cita de hoy — {cita.estado}
              {cita.consulta && " · consulta ya iniciada"}
            </span>
          </Card>
        </div>
      )}

      {!paciente.activo ? (
        <div className="mt-6">
          <Alert tone="warning">
            Este paciente está archivado. Reactívalo para poder crearle citas o consultas nuevas.
          </Alert>
          <form action={reactivarPacienteAction} className="mt-3">
            <input type="hidden" name="pacienteId" value={paciente.id} />
            <Button type="submit" variant="secondary">
              Reactivar paciente
            </Button>
          </form>
        </div>
      ) : (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {!citaNoDisponible && (
            <form action={iniciarConsultaAction}>
              <input type="hidden" name="pacienteId" value={paciente.id} />
              {citaId && <input type="hidden" name="citaId" value={citaId} />}
              <Button type="submit">
                {cita?.consulta ? "Continuar consulta" : "Iniciar consulta"}
              </Button>
            </form>
          )}
          <Link
            href={`/agenda/nueva?fecha=${hoyISO}&pacienteId=${paciente.id}`}
            className="inline-flex items-center rounded-button border border-brand-primary px-4 py-2 text-body-secondary font-semibold text-brand-primary transition hover:bg-brand-primary-soft"
          >
            + Nueva cita
          </Link>
          <form action={archivarPacienteAction} className="ml-auto">
            <input type="hidden" name="pacienteId" value={paciente.id} />
            <Button type="submit" variant="ghost" size="sm">
              Archivar paciente
            </Button>
          </form>
        </div>
      )}

      <TabsFicha tabActual={tab} pacienteId={paciente.id} />

      {tab === "resumen" && (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section>
              <SectionLabel>Consultas recientes</SectionLabel>
              <div className="mt-2">
                {consultasPrevias.length === 0 ? (
                  <EmptyState compact message="Sin consultas anteriores." />
                ) : (
                  <ul className="space-y-2">
                    {consultasPrevias.slice(0, 3).map((consulta) => (
                      <li key={consulta.id}>
                        <ConsultaHistorialCard consulta={consulta} />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

            {(() => {
              const proxima = proximaCita(citas);
              return (
                <section>
                  <SectionLabel>Próxima cita</SectionLabel>
                  <div className="mt-2">
                    {proxima ? (
                      <Card padding="cozy">
                        <span className="text-text-secondary">
                          {proxima.fechaHora.toLocaleDateString("es", {
                            weekday: "long",
                            day: "numeric",
                            month: "short",
                          })}{" "}
                          · {proxima.estado}
                        </span>
                      </Card>
                    ) : (
                      <EmptyState compact message="Sin citas programadas." />
                    )}
                  </div>
                </section>
              );
            })()}
          </div>

          <div className="space-y-6">
            <section>
              <SectionLabel>Signos vitales</SectionLabel>
              <div className="mt-2">
                <SignosVitalesCard consultas={consultasPrevias} />
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === "datos" && (
        <div className="mt-6 space-y-8">
          <section>
            <SectionLabel>Datos de contacto</SectionLabel>
            <dl className="mt-2 space-y-1 text-body-secondary text-text-secondary">
              {paciente.telefono && <div>Tel: {paciente.telefono}</div>}
              {paciente.email && <div>Email: {paciente.email}</div>}
              {paciente.direccion && <div>Dirección: {paciente.direccion}</div>}
              {paciente.contactoEmergenciaNombre && (
                <div>
                  Emergencia: {paciente.contactoEmergenciaNombre}
                  {paciente.contactoEmergenciaTelefono &&
                    ` — ${paciente.contactoEmergenciaTelefono}`}
                </div>
              )}
              {!paciente.telefono &&
                !paciente.email &&
                !paciente.direccion &&
                !paciente.contactoEmergenciaNombre && <div>Sin datos adicionales.</div>}
            </dl>
          </section>

          <TrazabilidadPacienteSeccion eventos={eventos} />
        </div>
      )}

      {tab === "antecedentes" && (
        <div className="mt-2">
          <AntecedentesSeccion
            pacienteId={paciente.id}
            antecedentes={antecedentes}
            crearAction={crearAntecedenteAction}
            editarAction={editarAntecedenteAction}
            desactivarAction={desactivarAntecedenteAction}
          />
        </div>
      )}

      {tab === "historial" && (
        <section className="mt-6">
          {consultasPrevias.length === 0 ? (
            <EmptyState compact message="Sin consultas anteriores." />
          ) : (
            <ul className="space-y-2">
              {consultasPrevias.map((consulta) => (
                <li key={consulta.id}>
                  <ConsultaHistorialCard consulta={consulta} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "tratamientos" && (
        <section className="mt-6">
          <TratamientosPacienteSeccion consultas={consultasPrevias} />
        </section>
      )}

      {tab === "citas" && (
        <div className="mt-2">
          <CitasPacienteSeccion citas={citas} />
        </div>
      )}

      {tab === "documentos" && (
        <div className="mt-2">
          <DocumentosPacienteSeccion documentos={documentos} />
        </div>
      )}

      {tab === "ia" && (
        <section className="mt-6">
          <Card padding="spacious" className="text-center">
            <Badge tone="info">Próximamente</Badge>
            <p className="mt-3 text-section-title font-semibold text-text-primary">
              Resumen del expediente con IA
            </p>
            <p className="mx-auto mt-1 max-w-sm text-body-secondary text-text-secondary">
              Todavía no existe el módulo de IA del producto — antes de
              construir esto hay que decidir su alcance (qué resume, con
              qué fuente, y que el médico apruebe cualquier contenido antes
              de que entre al expediente). No es un botón decorativo
              escondido: es una pieza que falta a propósito.
            </p>
          </Card>
        </section>
      )}
    </main>
  );
}

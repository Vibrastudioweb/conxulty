import Link from "next/link";
import type { EstadoCita, ModalidadCita } from "@prisma/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import { listarCitasDelDia, listarCitasEnRango } from "@/modules/core/citas";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import {
  CitaCard,
  ETIQUETAS_ESTADO_CITA,
  ETIQUETAS_MODALIDAD,
} from "@/components/citas/CitaCard";
import { CitaAccionesEstado } from "@/components/citas/CitaAccionesEstado";
import { FiltrosAgenda } from "@/components/citas/FiltrosAgenda";
import { SelectorVista, type VistaAgenda } from "@/components/citas/SelectorVista";
import { VistaSemana } from "@/components/citas/VistaSemana";
import { VistaMes } from "@/components/citas/VistaMes";
import {
  fechaDesdeParam,
  formatearFechaISO,
  sumarDias,
  inicioSemana,
  inicioMes,
} from "@/components/citas/fecha";
import {
  confirmarCitaAction,
  cancelarCitaAction,
  marcarAtendidaCitaAction,
  marcarNoAsistioCitaAction,
} from "./actions";

const ACCIONES_ESTADO = {
  CONFIRMADA: confirmarCitaAction,
  CANCELADA: cancelarCitaAction,
  ATENDIDA: marcarAtendidaCitaAction,
  NO_ASISTIO: marcarNoAsistioCitaAction,
};

function comoEstadoValido(valor?: string): EstadoCita | undefined {
  return valor && valor in ETIQUETAS_ESTADO_CITA ? (valor as EstadoCita) : undefined;
}

function comoModalidadValida(valor?: string): ModalidadCita | undefined {
  return valor && valor in ETIQUETAS_MODALIDAD ? (valor as ModalidadCita) : undefined;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{
    fecha?: string;
    vista?: string;
    estado?: string;
    modalidad?: string;
    actualizada?: string;
    error?: string;
  }>;
}) {
  const { session, medico } = await requireMedicoSesion();
  const {
    fecha: fechaParam,
    vista: vistaParam,
    estado: estadoParam,
    modalidad: modalidadParam,
    actualizada,
    error,
  } = await searchParams;

  const vista: VistaAgenda =
    vistaParam === "semana" || vistaParam === "mes" ? vistaParam : "dia";
  const fecha = fechaDesdeParam(fechaParam);
  const fechaISO = formatearFechaISO(fecha);
  const hoyISO = formatearFechaISO(new Date());
  const estado = comoEstadoValido(estadoParam);
  const modalidad = comoModalidadValida(modalidadParam);

  const queryBase = new URLSearchParams();
  queryBase.set("fecha", fechaISO);
  if (estado) queryBase.set("estado", estado);
  if (modalidad) queryBase.set("modalidad", modalidad);

  const volverA = `/agenda?${new URLSearchParams({
    vista,
    ...Object.fromEntries(queryBase),
  }).toString()}`;

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader
        title="Agenda"
        action={
          <Link
            href={`/agenda/nueva?fecha=${fechaISO}`}
            className="rounded-button bg-brand-primary px-4 py-2 text-body-secondary font-semibold text-white transition hover:bg-brand-primary-hover"
          >
            + Nueva cita
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <SelectorVista vistaActual={vista} queryBase={queryBase} />
        <FiltrosAgenda
          vista={vista}
          fecha={fechaISO}
          estado={estado}
          modalidad={modalidad}
        />
      </div>

      {actualizada && (
        <div className="mt-4">
          <Alert tone="success">Cita actualizada.</Alert>
        </div>
      )}
      {error === "estado" && (
        <div className="mt-4">
          <Alert tone="danger">
            No se pudo cambiar el estado de la cita. Puede que ya haya
            cambiado o que tenga una consulta en curso.
          </Alert>
        </div>
      )}
      {error === "no_editable" && (
        <div className="mt-4">
          <Alert tone="danger">Esa cita ya no puede editarse.</Alert>
        </div>
      )}

      {vista === "dia" && (
        <VistaDia
          fecha={fecha}
          fechaISO={fechaISO}
          hoyISO={hoyISO}
          organizacionId={session.user.organizacionId}
          medicoId={medico.id}
          estado={estado}
          modalidad={modalidad}
          volverA={volverA}
        />
      )}

      {vista === "semana" && (
        <VistaSemanaContainer
          fecha={fecha}
          hoyISO={hoyISO}
          organizacionId={session.user.organizacionId}
          medicoId={medico.id}
          estado={estado}
          modalidad={modalidad}
        />
      )}

      {vista === "mes" && (
        <VistaMesContainer
          fecha={fecha}
          hoyISO={hoyISO}
          organizacionId={session.user.organizacionId}
          medicoId={medico.id}
          estado={estado}
          modalidad={modalidad}
        />
      )}

      <div className="mt-8 border-t border-border pt-4">
        <Link href="/hoy" className="text-sm text-text-secondary hover:underline">
          ← Volver a Hoy
        </Link>
      </div>
    </main>
  );
}

async function VistaDia({
  fecha,
  fechaISO,
  hoyISO,
  organizacionId,
  medicoId,
  estado,
  modalidad,
  volverA,
}: {
  fecha: Date;
  fechaISO: string;
  hoyISO: string;
  organizacionId: string;
  medicoId: string;
  estado?: EstadoCita;
  modalidad?: ModalidadCita;
  volverA: string;
}) {
  const anteriorISO = formatearFechaISO(sumarDias(fecha, -1));
  const siguienteISO = formatearFechaISO(sumarDias(fecha, 1));

  const citas = await listarCitasDelDia({
    organizacionId,
    medicoId,
    fecha,
    estado,
    modalidad,
  });

  const etiquetaFecha = fecha.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const parametrosNav = new URLSearchParams();
  if (estado) parametrosNav.set("estado", estado);
  if (modalidad) parametrosNav.set("modalidad", modalidad);
  const sufijoNav = parametrosNav.toString() ? `&${parametrosNav.toString()}` : "";

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-2">
        <Link
          href={`/agenda?vista=dia&fecha=${anteriorISO}${sufijoNav}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          ← Anterior
        </Link>
        <div className="text-center">
          <p className="text-sm font-medium capitalize text-text-primary">
            {etiquetaFecha}
          </p>
          {fechaISO !== hoyISO && (
            <Link
              href={`/agenda?vista=dia&fecha=${hoyISO}${sufijoNav}`}
              className="text-xs text-brand-primary hover:underline"
            >
              Volver a hoy
            </Link>
          )}
        </div>
        <Link
          href={`/agenda?vista=dia&fecha=${siguienteISO}${sufijoNav}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          Siguiente →
        </Link>
      </div>

      <section className="mt-6">
        {citas.length === 0 ? (
          <EmptyState message="No hay citas para este día." />
        ) : (
          <ul className="space-y-2">
            {citas.map((cita) => (
              <li key={cita.id}>
                <CitaCard cita={cita} />
                <CitaAccionesEstado
                  cita={cita}
                  volverA={volverA}
                  acciones={ACCIONES_ESTADO}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

async function VistaSemanaContainer({
  fecha,
  hoyISO,
  organizacionId,
  medicoId,
  estado,
  modalidad,
}: {
  fecha: Date;
  hoyISO: string;
  organizacionId: string;
  medicoId: string;
  estado?: EstadoCita;
  modalidad?: ModalidadCita;
}) {
  const inicio = inicioSemana(fecha);
  const fin = sumarDias(inicio, 7);
  const anteriorISO = formatearFechaISO(sumarDias(fecha, -7));
  const siguienteISO = formatearFechaISO(sumarDias(fecha, 7));

  const citas = await listarCitasEnRango({
    organizacionId,
    medicoId,
    inicio,
    fin,
    estado,
    modalidad,
  });

  const etiquetaRango = `${inicio.toLocaleDateString("es", { day: "numeric", month: "short" })} – ${sumarDias(inicio, 6).toLocaleDateString("es", { day: "numeric", month: "short" })}`;

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-2">
        <Link
          href={`/agenda?vista=semana&fecha=${anteriorISO}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          ← Semana anterior
        </Link>
        <p className="text-sm font-medium text-text-primary">{etiquetaRango}</p>
        <Link
          href={`/agenda?vista=semana&fecha=${siguienteISO}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          Semana siguiente →
        </Link>
      </div>

      <section className="mt-6">
        <VistaSemana inicioSemana={inicio} citas={citas} hoyISO={hoyISO} />
      </section>
    </>
  );
}

async function VistaMesContainer({
  fecha,
  hoyISO,
  organizacionId,
  medicoId,
  estado,
  modalidad,
}: {
  fecha: Date;
  hoyISO: string;
  organizacionId: string;
  medicoId: string;
  estado?: EstadoCita;
  modalidad?: ModalidadCita;
}) {
  const mesAnteriorRef = new Date(fecha.getFullYear(), fecha.getMonth() - 1, 1);
  const mesSiguienteRef = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1);

  const inicioGrilla = inicioSemana(inicioMes(fecha));
  const finGrilla = sumarDias(inicioGrilla, 42);

  const citas = await listarCitasEnRango({
    organizacionId,
    medicoId,
    inicio: inicioGrilla,
    fin: finGrilla,
    estado,
    modalidad,
  });

  const etiquetaMes = fecha.toLocaleDateString("es", {
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <div className="mt-6 flex items-center justify-between gap-2">
        <Link
          href={`/agenda?vista=mes&fecha=${formatearFechaISO(mesAnteriorRef)}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          ← Mes anterior
        </Link>
        <p className="text-sm font-medium capitalize text-text-primary">
          {etiquetaMes}
        </p>
        <Link
          href={`/agenda?vista=mes&fecha=${formatearFechaISO(mesSiguienteRef)}`}
          className="rounded-button border border-border px-3 py-1.5 text-sm text-text-secondary hover:border-brand-primary"
        >
          Mes siguiente →
        </Link>
      </div>

      <section className="mt-6">
        <VistaMes mesReferencia={fecha} citas={citas} hoyISO={hoyISO} />
      </section>
    </>
  );
}

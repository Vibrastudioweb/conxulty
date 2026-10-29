import { redirect } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck2,
  CircleDollarSign,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { auth } from "@/auth";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import { listarCitasDelDia, listarCitasEnRango } from "@/modules/core/citas";
import { obtenerTotalCobradoDelDia } from "@/modules/cobros-caja/cobros";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { QuickAction } from "@/components/ui/QuickAction";
import { KpiCard } from "@/components/ui/KpiCard";
import { ActividadMensualChart } from "@/components/ui/ActividadMensualChart";
import { CitaCard } from "@/components/citas/CitaCard";

function primerNombre(nombreCompleto: string | null | undefined): string {
  if (!nombreCompleto) return "";
  return nombreCompleto.trim().split(/\s+/)[0] ?? "";
}

function formatearCobrosDelDia(
  totales: Array<{ moneda: string; total: number }>,
): { value: string; hint?: string } {
  if (totales.length === 0) {
    return { value: "$0" };
  }
  const formateados = totales.map(
    (t) =>
      `${t.moneda === "USD" ? "$" : t.moneda + " "}${t.total.toLocaleString("es", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })}`,
  );
  return {
    value: formateados[0],
    hint: formateados.length > 1 ? formateados.slice(1).join(" · ") : undefined,
  };
}

/**
 * Agrupa citas por día del mes para el gráfico "Actividad del mes" —
 * incluye TODOS los días del mes (incluso sin citas, en 0), para que las
 * barras queden alineadas por día y no haya que inferir huecos en la UI.
 */
function agruparCitasPorDiaDelMes(
  citas: Array<{ fechaHora: Date }>,
  inicioMes: Date,
  diaHoy: number,
): Array<{ dia: number; total: number; esHoy: boolean }> {
  const diasEnMes = new Date(
    inicioMes.getFullYear(),
    inicioMes.getMonth() + 1,
    0,
  ).getDate();

  const totalesPorDia = new Array(diasEnMes + 1).fill(0) as number[];
  for (const cita of citas) {
    totalesPorDia[cita.fechaHora.getDate()] += 1;
  }

  return Array.from({ length: diasEnMes }, (_, i) => {
    const dia = i + 1;
    return { dia, total: totalesPorDia[dia], esHoy: dia === diaHoy };
  });
}

function formatearFechaLarga(fecha: Date): string {
  const texto = fecha.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export default async function HoyPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.rol !== "MEDICO") {
    redirect(session.user.rol === "ADMIN" ? "/admin" : "/staff");
  }

  let medico;
  try {
    medico = await resolverMedicoAutenticado({
      organizacionId: session.user.organizacionId,
      usuarioId: session.user.id,
    });
  } catch {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
        <p className="text-sm text-text-secondary">
          Tu usuario no tiene un perfil médico asociado. Contacta a un
          administrador de tu organización.
        </p>
      </main>
    );
  }

  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesSiguiente = new Date(
    ahora.getFullYear(),
    ahora.getMonth() + 1,
    1,
  );

  const [citas, cobrosDelDia, citasDelMes] = await Promise.all([
    listarCitasDelDia({
      organizacionId: session.user.organizacionId,
      medicoId: medico.id,
      fecha: ahora,
    }),
    obtenerTotalCobradoDelDia({
      organizacionId: session.user.organizacionId,
      medicoId: medico.id,
      fecha: ahora,
    }),
    listarCitasEnRango({
      organizacionId: session.user.organizacionId,
      medicoId: medico.id,
      inicio: inicioMes,
      fin: inicioMesSiguiente,
    }),
  ]);

  const actividadDelMes = agruparCitasPorDiaDelMes(
    citasDelMes,
    inicioMes,
    ahora.getDate(),
  );

  const proxima = citas.find(
    (cita) => cita.estado === "PENDIENTE" || cita.estado === "CONFIRMADA",
  );
  const atendidas = citas.filter((cita) => cita.estado === "ATENDIDA").length;
  const pendientesConfirmar = citas.filter(
    (cita) => cita.estado === "PENDIENTE",
  ).length;
  const hayCitas = citas.length > 0;
  const cobrosHoy = formatearCobrosDelDia(cobrosDelDia);

  const accionesRapidas = (
    <>
      <QuickAction href="/agenda" icon={CalendarDays} label="Ver agenda" />
      <QuickAction
        href="/pacientes"
        icon={UserPlus}
        label="Nueva consulta sin cita"
        variant="primary"
      />
    </>
  );

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <header>
        <h1 className="font-display text-page-title font-semibold tracking-tight text-text-primary lg:text-display">
          {session.user.name
            ? `Hola, ${primerNombre(session.user.name)}`
            : "Hoy"}
        </h1>
        <p className="mt-1 text-body-secondary font-medium text-text-secondary lg:text-body">
          {formatearFechaLarga(ahora)}
        </p>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 lg:mt-8 lg:grid-cols-4">
        <KpiCard
          icon={CalendarDays}
          label="Citas de hoy"
          value={String(citas.length)}
        />
        <KpiCard
          icon={UserCheck}
          label="Pacientes atendidos"
          value={String(atendidas)}
        />
        <KpiCard
          icon={CircleDollarSign}
          label="Cobros del día"
          value={cobrosHoy.value}
          hint={cobrosHoy.hint}
        />
        <KpiCard
          icon={CalendarCheck2}
          label="Por confirmar"
          value={String(pendientesConfirmar)}
        />
      </section>

      <section className="mt-8 rounded-card border border-border bg-surface px-5 py-4 lg:mt-10">
        <SectionLabel>Actividad del mes</SectionLabel>
        <p className="mt-0.5 text-body-secondary text-text-faint">
          {citasDelMes.length} {citasDelMes.length === 1 ? "cita" : "citas"}{" "}
          en {ahora.toLocaleDateString("es", { month: "long" })}
        </p>
        <div className="mt-3">
          <ActividadMensualChart datos={actividadDelMes} />
        </div>
      </section>

      {!hayCitas ? (
        <section className="mt-8 rounded-card bg-brand-primary-soft px-6 py-10 text-center lg:mt-10 lg:py-12">
          <p className="text-section-title font-semibold text-text-primary">
            Tu agenda está despejada
          </p>
          <p className="mt-1 text-body-secondary text-text-secondary">
            Hoy no tienes consultas programadas.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {accionesRapidas}
          </div>
        </section>
      ) : (
        <>
          <section className="mt-8 rounded-card bg-brand-primary-soft px-5 py-4 lg:mt-10">
            <p className="text-section-title font-semibold text-text-primary">
              Tu jornada de hoy
            </p>
            <p className="mt-0.5 text-body-secondary text-text-secondary">
              {citas.length} {citas.length === 1 ? "consulta" : "consultas"}{" "}
              programada{citas.length === 1 ? "" : "s"}
              {atendidas > 0 &&
                ` · ${atendidas} atendida${atendidas === 1 ? "" : "s"}`}
            </p>
          </section>

          {proxima && (
            <section className="mt-8">
              <SectionLabel>Próxima consulta</SectionLabel>
              <div className="mt-2">
                <CitaCard cita={proxima} destacada />
              </div>
            </section>
          )}

          <section className="mt-10">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Agenda</SectionLabel>
              <span className="text-caption text-text-faint">
                {citas.length} {citas.length === 1 ? "cita" : "citas"}
              </span>
            </div>
            <div className="mt-3 divide-y divide-border">
              {citas.map((cita) => (
                <CitaCard key={cita.id} cita={cita} variant="row" />
              ))}
            </div>
          </section>

          <section className="mt-10">
            <SectionLabel>Acciones rápidas</SectionLabel>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {accionesRapidas}
            </div>
          </section>
        </>
      )}
    </main>
  );
}

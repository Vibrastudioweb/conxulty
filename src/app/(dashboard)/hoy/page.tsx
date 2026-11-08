import { redirect } from "next/navigation";
import {
  CalendarDays,
  CalendarCheck2,
  CircleDollarSign,
  UserCheck,
  UserPlus,
  Wallet,
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
import { TiraDiasSemana } from "@/components/citas/TiraDiasSemana";

/** Títulos profesionales que anteceden al nombre real en `Usuario.nombre`
 *  (p.ej. "Dr. Demo Odontólogo", "Dra. Carolina Pérez") — si no se
 *  descartan, el saludo toma el título como si fuera el nombre ("Hola,
 *  Dr."). Catálogo cerrado, no exhaustivo de todos los títulos posibles,
 *  pero cubre los reales de este producto (médicos/odontólogos). */
const TITULOS_A_OMITIR = new Set([
  "dr", "dr.", "dra", "dra.", "lic", "lic.", "lcdo", "lcdo.", "lcda", "lcda.",
]);

function primerNombre(nombreCompleto: string | null | undefined): string {
  if (!nombreCompleto) return "";
  const palabras = nombreCompleto.trim().split(/\s+/);
  const primera = palabras.find(
    (palabra) => !TITULOS_A_OMITIR.has(palabra.toLowerCase()),
  );
  return primera ?? palabras[0] ?? "";
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
      <QuickAction href="/caja" icon={Wallet} label="Registrar cobro" />
    </>
  );

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-6xl lg:px-10 lg:py-12">
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

      <div className="mt-6 grid grid-cols-1 gap-8 lg:mt-8 lg:grid-cols-[2.15fr_1fr] lg:items-start">
        {/* Columna principal: panorama del día (KPIs, actividad del mes,
            resumen de jornada/CTA, acciones rápidas). */}
        <div>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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

          <section className="mt-8 rounded-card border border-border bg-surface px-5 py-4">
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
            <section className="mt-8 rounded-card bg-brand-primary-soft px-6 py-10 text-center">
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
              <section className="mt-8 rounded-card bg-brand-primary-soft px-5 py-4">
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

              <section className="mt-10">
                <SectionLabel>Acciones rápidas</SectionLabel>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {accionesRapidas}
                </div>
              </section>
            </>
          )}
        </div>

        {/* Panel lateral "Hoy" (ver changelog punto 53): tira de la semana +
            próxima consulta + agenda del día. Sticky solo en desktop — en
            mobile ya es la última sección de una sola columna. */}
        <aside className="lg:sticky lg:top-8">
          <section className="rounded-card border border-border bg-surface px-4 py-4">
            <SectionLabel>Esta semana</SectionLabel>
            <div className="mt-2">
              <TiraDiasSemana hoy={ahora} />
            </div>
          </section>

          {proxima && (
            <section className="mt-6">
              <SectionLabel>Próxima consulta</SectionLabel>
              <div className="mt-2">
                <CitaCard cita={proxima} destacada />
              </div>
            </section>
          )}

          <section className="mt-6">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Agenda de hoy</SectionLabel>
              <span className="text-caption text-text-faint">
                {citas.length} {citas.length === 1 ? "cita" : "citas"}
              </span>
            </div>
            {hayCitas ? (
              <div className="mt-2 divide-y divide-border rounded-card border border-border bg-surface px-3">
                {citas.map((cita) => (
                  <CitaCard key={cita.id} cita={cita} variant="row" />
                ))}
              </div>
            ) : (
              <p className="mt-2 text-body-secondary text-text-faint">
                Sin consultas programadas para hoy.
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

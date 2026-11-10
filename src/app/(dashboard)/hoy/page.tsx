import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  CalendarCheck2,
  CircleDollarSign,
  IdCard,
  Star,
  UserCheck,
  UserPlus,
  Wallet,
} from "lucide-react";
import { auth } from "@/auth";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import {
  listarCitasDelDia,
  listarCitasDelDiaConDetalle,
  listarCitasEnRango,
} from "@/modules/core/citas";
import { obtenerTotalCobradoDelDia } from "@/modules/cobros-caja/cobros";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { KpiCard, type KpiDelta } from "@/components/ui/KpiCard";
import { QuickActionTile } from "@/components/ui/QuickActionTile";
import { ActividadMensualChart } from "@/components/ui/ActividadMensualChart";
import { CitaCard } from "@/components/citas/CitaCard";
import { ListaCitasSeleccionable } from "@/components/citas/ListaCitasSeleccionable";
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

/** Delta simple de conteo (citas, pacientes, pendientes) contra el mismo
 *  dato de ayer — ver changelog punto 54. A diferencia de la demo, que
 *  mostraba deltas de relleno, este SÍ se calcula contra datos reales. */
function calcularDelta(actual: number, anterior: number): KpiDelta {
  const diferencia = actual - anterior;
  if (diferencia === 0) return { direccion: "flat", texto: "Igual que ayer" };
  const signo = diferencia > 0 ? "+" : "";
  return {
    direccion: diferencia > 0 ? "up" : "down",
    texto: `${signo}${diferencia} vs. ayer`,
  };
}

/** Delta de cobros contra ayer — usa únicamente la PRIMERA moneda que
 *  aparezca (hoy, o si hoy no cobró nada, la de ayer), para no mezclar
 *  monedas en una sola cifra ni inventar matemática multi-moneda (ver
 *  nota de `formatearCobrosDelDia` / punto 54: simplificación deliberada,
 *  "sin complicarlo"). Si ninguno de los dos días tiene cobros, no hay
 *  moneda de referencia y el delta queda "Igual que ayer". */
function calcularDeltaCobros(
  totalesHoy: Array<{ moneda: string; total: number }>,
  totalesAyer: Array<{ moneda: string; total: number }>,
): KpiDelta {
  const monedaRef = totalesHoy[0]?.moneda ?? totalesAyer[0]?.moneda;
  if (!monedaRef) return { direccion: "flat", texto: "Igual que ayer" };
  const totalHoy = totalesHoy.find((t) => t.moneda === monedaRef)?.total ?? 0;
  const totalAyer = totalesAyer.find((t) => t.moneda === monedaRef)?.total ?? 0;
  const diferencia = totalHoy - totalAyer;
  if (diferencia === 0) return { direccion: "flat", texto: "Igual que ayer" };
  const simbolo = monedaRef === "USD" ? "$" : `${monedaRef} `;
  const monto = Math.abs(diferencia).toLocaleString("es", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return {
    direccion: diferencia > 0 ? "up" : "down",
    texto: `${diferencia > 0 ? "+" : "-"}${simbolo}${monto} vs. ayer`,
  };
}

export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ semana?: string }>;
}) {
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
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesSiguiente = new Date(
    ahora.getFullYear(),
    ahora.getMonth() + 1,
    1,
  );

  // Paginación de "Esta semana" (ver changelog punto 54, TiraDiasSemana):
  // solo cambia qué semana se dibuja en la tira lateral, no la agenda de
  // abajo, que sigue siendo siempre la de "hoy".
  const paramsBusqueda = await searchParams;
  const offsetSemana = Number.parseInt(paramsBusqueda.semana ?? "0", 10) || 0;
  const fechaReferenciaSemana = new Date(ahora);
  fechaReferenciaSemana.setDate(
    fechaReferenciaSemana.getDate() + offsetSemana * 7,
  );

  const [citas, cobrosDelDia, citasDelMes, citasAyer, cobrosAyer] =
    await Promise.all([
      listarCitasDelDiaConDetalle({
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
      listarCitasDelDia({
        organizacionId: session.user.organizacionId,
        medicoId: medico.id,
        fecha: ayer,
      }),
      obtenerTotalCobradoDelDia({
        organizacionId: session.user.organizacionId,
        medicoId: medico.id,
        fecha: ayer,
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
  // "Próximas citas" como sección propia desapareció en el rediseño
  // 10-nov-2026: su contenido (lo que falta por pasar hoy) ya está
  // cubierto por "Agenda de hoy", que ahora vive en la columna central
  // en vez del panel lateral.
  const atendidas = citas.filter((cita) => cita.estado === "ATENDIDA").length;
  const pendientesConfirmar = citas.filter(
    (cita) => cita.estado === "PENDIENTE",
  ).length;
  const hayCitas = citas.length > 0;
  const cobrosHoy = formatearCobrosDelDia(cobrosDelDia);

  const atendidasAyer = citasAyer.filter(
    (cita) => cita.estado === "ATENDIDA",
  ).length;
  const pendientesConfirmarAyer = citasAyer.filter(
    (cita) => cita.estado === "PENDIENTE",
  ).length;

  const deltaCitas = calcularDelta(citas.length, citasAyer.length);
  const deltaAtendidas = calcularDelta(atendidas, atendidasAyer);
  const deltaCobros = calcularDeltaCobros(cobrosDelDia, cobrosAyer);
  const deltaPendientes = calcularDelta(
    pendientesConfirmar,
    pendientesConfirmarAyer,
  );

  // "Nueva consulta sin cita" va directo a /pacientes/nuevo, no a
  // /pacientes (punto 57): el usuario pidió un acceso DIRECTO desde /hoy,
  // y aterrizar en la lista de pacientes todavía exigía un clic más
  // ("+ Nuevo paciente") para llegar a donde la tile dice que lleva.
  const accionesRapidas = (
    <>
      <QuickActionTile
        href="/agenda"
        icon={CalendarDays}
        title="Ver agenda"
        subtitle="Toda la semana"
        accent="indigo"
      />
      <QuickActionTile
        href="/pacientes/nuevo"
        icon={UserPlus}
        title="Nueva consulta sin cita"
        subtitle="Registra un paciente ahora"
        accent="green"
      />
      <QuickActionTile
        href="/caja"
        icon={Wallet}
        title="Registrar cobro"
        subtitle="Cobros y caja del día"
        accent="amber"
      />
      <QuickActionTile
        href="/ficha-publica"
        icon={IdCard}
        title="Mi ficha pública"
        subtitle="Cómo te ven tus pacientes"
        accent="sky"
      />
      <QuickActionTile
        href="/resenas"
        icon={Star}
        title="Reseñas"
        subtitle="Ver y moderar reseñas"
        accent="indigo"
      />
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

      {/*
       * Rediseño 10-nov-2026 (ver changelog): grid de 3 columnas en vez de
       * fila de KPIs + fila gráfico/CTA + grid de acciones + sidebar
       * aparte. Objetivo explícito del usuario: aprovechar el 100% de la
       * pantalla sin espacios vacíos. No agrega NINGÚN dato ni consulta
       * nueva — es la misma información de siempre (KPIs, agenda del día,
       * actividad del mes, próxima consulta, tira de la semana, accesos
       * rápidos), solo reordenada en columnas densas. "Pacientes
       * atendidos"/"chart-row"/"Próximas citas" como secciones separadas
       * desaparecen porque su contenido ya vive en "Agenda de hoy" y
       * "Resumen de hoy" de abajo.
       */}
      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Izquierda: accesos rápidos (mismas 5 tiles de siempre, ahora
            agrupadas en su propia columna en vez de una fila debajo). */}
        <div className="lg:col-span-3">
          <section>
            <SectionLabel>Accesos rápidos</SectionLabel>
            <div className="mt-2 grid grid-cols-1 gap-3">{accionesRapidas}</div>
          </section>
        </div>

        {/* Centro: la jornada de hoy — próxima consulta, agenda completa
            del día y actividad del mes, todo con los mismos datos que ya
            calculaba esta página. */}
        <div className="lg:col-span-6 flex flex-col gap-5">
          {proxima && (
            <section>
              <SectionLabel>Próxima consulta</SectionLabel>
              <div className="mt-2">
                <CitaCard cita={proxima} destacada />
              </div>
            </section>
          )}

          {hayCitas ? (
            <section className="rounded-card border border-border bg-surface px-4 py-3">
              <div className="flex items-baseline justify-between">
                <SectionLabel>Agenda de hoy</SectionLabel>
                <span className="text-caption text-text-faint">
                  {citas.length} {citas.length === 1 ? "cita" : "citas"}
                </span>
              </div>
              <ListaCitasSeleccionable
                citas={citas.slice(0, 5)}
                variant="row"
                className="mt-2 divide-y divide-border"
              />
              {citas.length > 5 && (
                <Link
                  href="/agenda"
                  className="mt-2 block rounded-button border border-border px-3 py-2 text-center text-caption font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary-soft"
                >
                  Ver todas ({citas.length}) →
                </Link>
              )}
            </section>
          ) : (
            /* Estado vacío con presencia real (no una línea de texto suelta
               en una caja delgada — ver changelog, regresión corregida el
               mismo 10-nov-2026): esta es la sección que más espacio deja
               cuando no hay citas, así que es la que más necesita llenar
               bien ese espacio, con una acción real en vez de solo avisar. */
            <section className="flex min-h-[220px] flex-col items-center justify-center rounded-card bg-brand-primary-soft px-6 py-8 text-center">
              <p className="text-section-title font-semibold text-text-primary">
                Tu agenda está despejada
              </p>
              <p className="mt-1 text-body-secondary text-text-secondary">
                Hoy no tienes consultas programadas.
              </p>
              <Link
                href="/pacientes/nuevo"
                className="mt-4 rounded-button bg-brand-primary px-4 py-2 text-body-secondary font-semibold text-white transition hover:bg-brand-primary-hover"
              >
                Registrar una consulta
              </Link>
            </section>
          )}

          <section className="rounded-card border border-border bg-surface px-4 py-3">
            <SectionLabel>Actividad del mes</SectionLabel>
            <p className="mt-0.5 text-body-secondary text-text-faint">
              {citasDelMes.length}{" "}
              {citasDelMes.length === 1 ? "cita" : "citas"} en{" "}
              {ahora.toLocaleDateString("es", { month: "long" })}
            </p>
            <div className="mt-2">
              <ActividadMensualChart datos={actividadDelMes} />
            </div>
          </section>
        </div>

        {/* Derecha: tira de la semana + resumen del día (los mismos 4 KPIs
            de siempre, solo que ahora en su propia columna sticky en vez
            de una fila horizontal arriba de todo). */}
        <aside className="lg:col-span-3 lg:sticky lg:top-8 flex flex-col gap-5">
          <section className="rounded-card border border-border bg-surface px-4 py-3">
            <SectionLabel>Esta semana</SectionLabel>
            <div className="mt-2">
              <TiraDiasSemana
                hoy={ahora}
                fechaReferencia={fechaReferenciaSemana}
                hrefSemanaAnterior={`/hoy?semana=${offsetSemana - 1}`}
                hrefSemanaSiguiente={`/hoy?semana=${offsetSemana + 1}`}
              />
            </div>
          </section>

          <section className="rounded-card border border-border bg-surface px-4 py-3">
            <SectionLabel>Resumen de hoy</SectionLabel>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <KpiCard
                icon={CalendarDays}
                label="Citas de hoy"
                value={String(citas.length)}
                accent="indigo"
                delta={deltaCitas}
                href="/agenda"
              />
              <KpiCard
                icon={UserCheck}
                label="Atendidos"
                value={String(atendidas)}
                accent="green"
                delta={deltaAtendidas}
                href="/agenda?estado=ATENDIDA"
              />
              <KpiCard
                icon={CircleDollarSign}
                label="Cobros"
                value={cobrosHoy.value}
                hint={cobrosHoy.hint}
                accent="amber"
                delta={deltaCobros}
                href="/caja"
              />
              <KpiCard
                icon={CalendarCheck2}
                label="Por confirmar"
                value={String(pendientesConfirmar)}
                accent="sky"
                delta={deltaPendientes}
                href="/agenda?estado=PENDIENTE"
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}

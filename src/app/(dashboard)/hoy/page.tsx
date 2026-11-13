import { redirect } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  CalendarCheck2,
  CircleDollarSign,
  IdCard,
  Plus,
  UserCheck,
  Wallet,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/db/client";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import {
  listarCitasDelDia,
  listarCitasDelDiaConDetalle,
  listarCitasEnRango,
} from "@/modules/core/citas";
import {
  obtenerTotalCobradoDelDia,
  obtenerTotalCobradoEnRango,
} from "@/modules/cobros-caja/cobros";
import { listarResenasPublicadas } from "@/modules/directorio/resenas";
import { planIncluyeModulo } from "@/modules/suscripcion/plan";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { KpiCard, type KpiDelta } from "@/components/ui/KpiCard";
import { QuickActionTile } from "@/components/ui/QuickActionTile";
import { ActividadMensualChart } from "@/components/ui/ActividadMensualChart";
import { CalendarioMes } from "@/components/ui/CalendarioMes";
import { EstaSemanaBarras } from "@/components/ui/EstaSemanaBarras";
import { CitaCard } from "@/components/citas/CitaCard";
import { ListaCitasSeleccionable } from "@/components/citas/ListaCitasSeleccionable";

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

/** Formatea un total de cobros (agrupado por moneda) a texto — se usa
 *  tanto para el total del día como para el acumulado del mes, por eso el
 *  nombre genérico (antes se llamaba `formatearCobrosDelDia`, pero ya no
 *  es solo del día — ver changelog 10-nov-2026, tarjeta "Cobros"). */
function formatearTotalesCobro(
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

const DIAS_UNA_LETRA = ["L", "M", "X", "J", "V", "S", "D"];

function inicioDeSemana(fecha: Date): Date {
  const copia = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  // getDay(): 0=domingo..6=sábado — la semana empieza en lunes.
  const diferencia = (copia.getDay() + 6) % 7;
  copia.setDate(copia.getDate() - diferencia);
  return copia;
}

/**
 * Agrupa citas por día de ESTA semana (lunes a domingo) para "Esta
 * semana" en barras (10-nov-2026) — mismo criterio que
 * `agruparCitasPorDiaDelMes`, pero para 7 días en vez de todo el mes.
 */
function agruparCitasPorDiaDeSemana(
  citas: Array<{ fechaHora: Date }>,
  hoy: Date,
): Array<{ letra: string; total: number; esHoy: boolean }> {
  const inicio = inicioDeSemana(hoy);
  const totalesPorDia = new Array(7).fill(0) as number[];
  for (const cita of citas) {
    const diferenciaDias = Math.floor(
      (new Date(
        cita.fechaHora.getFullYear(),
        cita.fechaHora.getMonth(),
        cita.fechaHora.getDate(),
      ).getTime() -
        inicio.getTime()) /
        86_400_000,
    );
    if (diferenciaDias >= 0 && diferenciaDias < 7) {
      totalesPorDia[diferenciaDias] += 1;
    }
  }

  return DIAS_UNA_LETRA.map((letra, i) => {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    return {
      letra,
      total: totalesPorDia[i],
      esHoy: dia.toDateString() === hoy.toDateString(),
    };
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
 *  nota de `formatearTotalesCobro` / punto 54: simplificación deliberada,
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
  const ayer = new Date(ahora);
  ayer.setDate(ayer.getDate() - 1);
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const inicioMesSiguiente = new Date(
    ahora.getFullYear(),
    ahora.getMonth() + 1,
    1,
  );
  const inicioSemana = inicioDeSemana(ahora);
  const inicioSemanaSiguiente = new Date(inicioSemana);
  inicioSemanaSiguiente.setDate(inicioSemanaSiguiente.getDate() + 7);

  const organizacion = await prisma.organizacion.findUniqueOrThrow({
    where: { id: session.user.organizacionId },
    select: { fichaDirectorioId: true, plan: true },
  });
  // 13-nov-2026 (hallazgo C2): cobros y consultas son del plan Pro. En
  // Ficha no se muestran sus accesos ni el total de cobros — serían una
  // tarjeta en cero y botones que terminan en la pantalla de "esto es de
  // Pro". Crear pacientes sí es de Ficha, así que ese botón se queda, con
  // el nombre que corresponde.
  const tienePro = planIncluyeModulo(organizacion.plan, "caja");

  const [
    citas,
    cobrosDelDia,
    cobrosDelMes,
    citasDelMes,
    citasDeLaSemana,
    citasAyer,
    cobrosAyer,
    resenas,
  ] = await Promise.all([
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
    obtenerTotalCobradoEnRango({
      organizacionId: session.user.organizacionId,
      medicoId: medico.id,
      inicio: inicioMes,
      fin: inicioMesSiguiente,
    }),
    listarCitasEnRango({
      organizacionId: session.user.organizacionId,
      medicoId: medico.id,
      inicio: inicioMes,
      fin: inicioMesSiguiente,
    }),
    listarCitasEnRango({
      organizacionId: session.user.organizacionId,
      medicoId: medico.id,
      inicio: inicioSemana,
      fin: inicioSemanaSiguiente,
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
    // "Reseñas recientes" (10-nov-2026): solo se pide al Directorio si ya
    // hay ficha pública — sin fichaDirectorioId no hay nada que traer, y
    // evita una llamada de red condenada a fallar.
    organizacion.fichaDirectorioId
      ? listarResenasPublicadas(organizacion.fichaDirectorioId)
      : Promise.resolve(null),
  ]);

  const actividadDelMes = agruparCitasPorDiaDelMes(
    citasDelMes,
    inicioMes,
    ahora.getDate(),
  );
  const actividadDeLaSemana = agruparCitasPorDiaDeSemana(
    citasDeLaSemana,
    ahora,
  );

  const proxima = citas.find(
    (cita) => cita.estado === "PENDIENTE" || cita.estado === "CONFIRMADA",
  );
  const atendidas = citas.filter((cita) => cita.estado === "ATENDIDA").length;
  const pendientesConfirmar = citas.filter(
    (cita) => cita.estado === "PENDIENTE",
  ).length;
  const hayCitas = citas.length > 0;
  const cobrosHoy = formatearTotalesCobro(cobrosDelDia);
  const cobrosMes = formatearTotalesCobro(cobrosDelMes);

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

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-none lg:px-10 lg:py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-page-title font-semibold tracking-tight text-text-primary lg:text-display">
            {session.user.name
              ? `Hola, ${primerNombre(session.user.name)}`
              : "Hoy"}
          </h1>
          <p className="mt-1 text-body-secondary font-medium text-text-secondary lg:text-body">
            {formatearFechaLarga(ahora)}
          </p>
        </div>
        {/* "Nueva consulta sin cita" arriba en vez de ser una tile más de
            accesos rápidos (10-nov-2026, ver boceto) — va directo a
            /pacientes/nuevo, no a /pacientes (punto 57): el usuario pidió
            un acceso DIRECTO desde /hoy. */}
        <Link
          href="/pacientes/nuevo"
          className="inline-flex items-center gap-2 rounded-button bg-brand-primary px-4 py-2.5 text-body-secondary font-semibold text-white transition hover:bg-brand-primary-hover"
        >
          <Plus size={16} aria-hidden="true" />
          {tienePro ? "Nueva consulta sin cita" : "Nuevo paciente"}
        </Link>
      </header>

      {/*
       * Rediseño 10-nov-2026 (ver changelog): grid de 3 columnas, igual al
       * boceto aprobado. Objetivo explícito del usuario: aprovechar el
       * 100% de la pantalla sin espacios vacíos. Piezas nuevas construidas
       * para igualar el boceto exacto (antes no existían): "Cobros" con
       * acumulado del mes, "Reseñas recientes" (nueva llamada al
       * Directorio, /api/resenas-publicadas), calendario de mes
       * (`CalendarioMes`) y "Esta semana" en barras (`EstaSemanaBarras`,
       * reemplaza la tira `TiraDiasSemana` — se pierde su paginación a
       * otras semanas, que el boceto no tenía; /agenda sigue sirviendo
       * para eso).
       */}
      {/* 10-nov-2026 (revertido): se había probado estirar la última
          tarjeta de cada columna (`flex-1`) para que las 3 columnas
          terminaran a la misma altura y no quedara lienzo gris debajo de
          las más cortas. Resultado real: con pocos datos, esa tarjeta
          estirada se convertía en una caja gigante con relleno en blanco
          adentro — el vacío no desaparecía, solo se movía de "detrás de la
          columna" a "dentro de la tarjeta" (ni parecido al boceto, que
          tiene tarjetas compactas, del tamaño de su contenido). Vuelve a
          `items-start`: cada tarjeta mide lo que necesita su contenido;
          las columnas pueden terminar a distinta altura, igual que en
          cualquier dashboard real (Stripe, Linear, Notion no igualan
          columnas a la fuerza). */}
      <div className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-12">
        {/* Izquierda: accesos rápidos + cobros + reseñas recientes. */}
        <div className="lg:col-span-3 flex flex-col gap-5">
          <section>
            <SectionLabel>Accesos rápidos</SectionLabel>
            <div className="mt-2 grid grid-cols-1 gap-3">
              <QuickActionTile
                href="/agenda"
                icon={CalendarDays}
                title="Ver agenda completa"
                subtitle="Toda la semana"
                accent="indigo"
              />
              {tienePro && (
                <QuickActionTile
                  href="/caja"
                  icon={Wallet}
                  title="Registrar cobro"
                  subtitle="Cobros y caja del día"
                  accent="green"
                />
              )}
              <QuickActionTile
                href="/ficha-publica"
                icon={IdCard}
                title="Mi ficha pública"
                subtitle="Cómo te ven tus pacientes"
                accent="sky"
              />
            </div>
          </section>

          {tienePro && (
            <section className="rounded-card border border-border bg-surface px-4 py-3">
              <SectionLabel>Cobros</SectionLabel>
              <div className="mt-2">
                <p className="font-display text-page-title font-semibold text-text-primary">
                  {cobrosHoy.value}
                </p>
                <p className="mt-0.5 text-caption text-text-faint">
                  Hoy{deltaCobros.direccion !== "flat" && ` · ${deltaCobros.texto}`}
                  {deltaCobros.direccion === "flat" && " · igual que ayer"}
                </p>
              </div>
              <div className="my-3 h-px bg-border" />
              <div>
                <p className="text-section-title font-semibold text-text-primary">
                  {cobrosMes.value}
                </p>
                <p className="mt-0.5 text-caption text-text-faint">
                  {ahora.toLocaleDateString("es", { month: "long" })}, acumulado
                </p>
              </div>
            </section>
          )}

          {resenas?.ok && (
            <section className="rounded-card border border-border bg-surface px-4 py-3">
              <div className="flex items-center justify-between">
                <SectionLabel>Reseñas recientes</SectionLabel>
                {resenas.promedio !== null && (
                  <span className="text-caption font-semibold text-text-primary">
                    {resenas.promedio.toFixed(1)} ★
                  </span>
                )}
              </div>
              {resenas.resenas.length === 0 ? (
                <p className="mt-2 text-body-secondary text-text-faint">
                  Todavía no tienes reseñas publicadas.
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-2.5">
                  {resenas.resenas.slice(0, 3).map((resena) => (
                    <div key={resena.id}>
                      <p className="text-caption font-semibold text-text-primary">
                        {"★".repeat(resena.estrellas)}
                        {"☆".repeat(5 - resena.estrellas)} {resena.nombre}
                      </p>
                      {resena.comentario && (
                        <p className="mt-0.5 line-clamp-2 text-caption text-text-secondary">
                          &quot;{resena.comentario}&quot;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/resenas"
                className="mt-3 block text-caption font-semibold text-brand-primary hover:underline"
              >
                Ver todas las reseñas →
              </Link>
            </section>
          )}
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

          {/* Misma tarjeta siempre (mismo tamaño, con o sin citas) — el
              usuario pidió explícitamente que no cambie de forma según
              haya o no citas, solo su contenido interno. */}
          <section className="flex min-h-[190px] flex-col rounded-card border border-border bg-surface px-4 py-3">
            <div className="flex items-baseline justify-between">
              <SectionLabel>Agenda de hoy</SectionLabel>
              <span className="text-caption text-text-faint">
                {citas.length} {citas.length === 1 ? "cita" : "citas"}
              </span>
            </div>
            {hayCitas ? (
              <>
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
              </>
            ) : (
              <div className="mt-2 flex flex-1 flex-col items-center justify-center text-center">
                <p className="text-body-secondary font-medium text-text-secondary">
                  Sin consultas programadas para hoy.
                </p>
                <Link
                  href="/pacientes/nuevo"
                  className="mt-3 rounded-button border border-border px-4 py-2 text-caption font-semibold text-brand-primary transition hover:border-brand-primary hover:bg-brand-primary-soft"
                >
                  Registrar una consulta
                </Link>
              </div>
            )}
          </section>

          <section
            id="actividad-del-mes"
            className="rounded-card border border-border bg-surface px-4 py-3"
          >
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

        {/* Derecha: calendario de mes + esta semana (en barras) + resumen
            del día (los mismos 4 KPIs de siempre). */}
        <aside className="lg:col-span-3 lg:sticky lg:top-8 flex flex-col gap-3">
          <section className="rounded-card border border-border bg-surface px-4 py-2.5">
            <CalendarioMes hoy={ahora} />
          </section>

          <section className="rounded-card border border-border bg-surface px-4 py-2.5">
            <SectionLabel>Esta semana</SectionLabel>
            <div className="mt-2">
              <EstaSemanaBarras datos={actividadDeLaSemana} />
            </div>
            <Link
              href="#actividad-del-mes"
              className="mt-2 block text-caption font-semibold text-brand-primary hover:underline"
            >
              Ver actividad del mes →
            </Link>
          </section>

          <section className="rounded-card border border-border bg-surface px-4 py-2.5">
            <SectionLabel>Resumen de hoy</SectionLabel>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <KpiCard
                dense
                icon={CalendarDays}
                label="Citas de hoy"
                value={String(citas.length)}
                accent="indigo"
                delta={deltaCitas}
                href="/agenda"
              />
              <KpiCard
                dense
                icon={UserCheck}
                label="Atendidos"
                value={String(atendidas)}
                accent="green"
                delta={deltaAtendidas}
                href="/agenda?estado=ATENDIDA"
              />
              {tienePro && (
                <KpiCard
                  dense
                  icon={CircleDollarSign}
                  label="Cobros"
                  value={cobrosHoy.value}
                  hint={cobrosHoy.hint}
                  accent="amber"
                  delta={deltaCobros}
                  href="/caja"
                />
              )}
              <KpiCard
                dense
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

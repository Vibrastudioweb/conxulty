"use server";

import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { requireMedicoSesion } from "@/modules/core/autorizacion";
import {
  sincronizarFichaDirectorio,
  subirFotoDirectorio,
  obtenerFichaDirectorio,
  resolverEspecialidadId,
} from "@/modules/directorio/sincronizacion";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { MODALIDADES_ATENCION, type ModalidadAtencionId } from "@/modules/onboarding/modalidades";
import {
  leerHorarioSedeDeFormData,
  detectarChoquesHorarioSedes,
  type HorarioDia,
  type ChoqueHorario,
} from "@/modules/onboarding/horarioSede";

// 11-nov-2026: `HorarioDia[]` está en orden Lunes→Domingo — el mismo
// orden que `dia_semana` 1-7 (ISO, 1=lunes) de `horarios_sede` en
// vitalud. El índice (+1) es directamente ese número, sin tabla de mapeo.
function horarioParaDirectorio(horario: HorarioDia[]): Array<{ diaSemana: number; horaInicio: string; horaFin: string }> {
  return horario
    .map((h, i) => ({ ...h, diaSemana: i + 1 }))
    .filter(
      (h): h is HorarioDia & { diaSemana: number; horaInicio: string; horaFin: string } =>
        h.atiende && !!h.horaInicio && !!h.horaFin,
    )
    .map((h) => ({ diaSemana: h.diaSemana, horaInicio: h.horaInicio, horaFin: h.horaFin }));
}

// 10-nov-2026, pedido del usuario ("donde edita un medico sedes horarios y
// ubicaciones y modalidad de consultas"): hasta ahora NO HABÍA pantalla
// para esto — `Sede` solo se creaba una vez en /registro (nunca se
// actualizaba ni se borraba) y `Medico.modalidades` tampoco se tocaba
// después. Esta pantalla ("Mi ficha pública") ya editaba lo que el
// Directorio necesita de cada sede (ciudad, consultorio/sector, mapa);
// ahora también edita la sede real del OS — mismo patrón de campos y
// límite que /registro (SEDES_MAX, horario por día, choque de horario).
const SEDES_MAX = 3;

function leerSedeDeFormData(
  formData: FormData,
  prefijo: string,
): { municipio: string; direccion: string; referencia: string | null; horario: HorarioDia[] } | null {
  const municipio = vacio(formData.get(`${prefijo}_municipio`));
  const direccion = vacio(formData.get(`${prefijo}_direccion`));
  if (!municipio || !direccion) return null;
  return {
    municipio,
    direccion,
    referencia: vacio(formData.get(`${prefijo}_referencia`)) ?? null,
    horario: leerHorarioSedeDeFormData(formData, prefijo),
  };
}

const fichaPublicaSchema = z.object({
  descripcion: z.string().trim().max(2000).optional(),
  instagram: z.string().trim().max(160).optional(),
  correo: z.string().trim().max(160).optional(),
  sitioWeb: z.string().trim().max(500).optional(),
  rif: z.string().trim().max(40).optional(),
  domicilioFiscal: z.string().trim().max(300).optional(),
  // 10-nov-2026: "disponibilidad" se saca de acá y del formulario — nunca
  // se imprimía en la ficha pública (confirmado en el código de vitalud),
  // era un campo que se guardaba sin ningún destino.
  // 10-nov-2026: se sacaron del registro ("menos pasos") — ahora se
  // editan acá y se persisten en `Medico`, no solo se sincronizan.
  cedula: z.string().trim().max(40).optional(),
  numeroColegiado: z.string().trim().max(40).optional(),
  numeroMpps: z.string().trim().max(40).optional(),
  // 10-nov-2026, corregido el mismo día: esto se había sacado del schema
  // asumiendo que siempre llegaba de /registro — ya no es así, /registro
  // se simplificó y esta pantalla volvió a ser la única donde se elige
  // (ver FichaPublicaForm.tsx). El id real del catálogo del Directorio se
  // sigue resolviendo solo, por texto, con `resolverEspecialidadId`.
  especialidad: z.string().trim().max(160).optional(),
  especialidadSecundaria1: z.string().trim().max(160).optional(),
  // 10-nov-2026, pedido del usuario ("el unico telefono que se debe pedir
  // y existir el el whatsapp de el medico no uno para cada sede"): antes
  // se pedía un teléfono por sede acá mismo (`sedeOs_<id>_telefono`) —
  // ahora es uno solo para toda la ficha, se persiste en `Medico` y se
  // manda igual a cada sede del Directorio (ver sedesConCiudad más abajo).
  telefonoPublico: z.string().trim().max(40).optional(),
});

// Task #13: el médico edita la lista con ServiciosPreciosForm.tsx, que
// mantiene el estado completo en UN input oculto (`servicios`, JSON) —
// más simple que repuntar índice por índice del lado del servidor. Se
// valida acá, no se confía en el JSON tal cual llega del cliente.
const servicioPrecioSchema = z.object({
  nombre: z.string().trim().min(1).max(160),
  precio: z.number().finite().min(0).nullable(),
});
const serviciosSchema = z.array(servicioPrecioSchema).max(20);

function leerServiciosDeFormData(formData: FormData): { nombre: string; precio: number | null }[] {
  const crudo = formData.get("servicios")?.toString();
  if (!crudo) return [];
  try {
    const parseo = serviciosSchema.safeParse(JSON.parse(crudo));
    return parseo.success ? parseo.data : [];
  } catch {
    // JSON inválido (no debería pasar viniendo del propio formulario) —
    // se descarta en vez de bloquear el resto del guardado.
    return [];
  }
}

// Task #14: mismo patrón que servicios — texto libre, sin catálogo
// cerrado (no se investigó ninguno compartido con el Directorio).
const aseguradorasSchema = z.array(z.string().trim().min(1).max(160)).max(15);

function leerAseguradorasDeFormData(formData: FormData): string[] {
  const crudo = formData.get("aseguradoras")?.toString();
  if (!crudo) return [];
  try {
    const parseo = aseguradorasSchema.safeParse(JSON.parse(crudo));
    return parseo.success ? parseo.data : [];
  } catch {
    return [];
  }
}

export type GuardarFichaPublicaResultado =
  | { ok: true; slug: string; advertenciaFoto?: string; advertenciaChoques?: string }
  | { ok: false; error: string }
  | null;

/** Mismo criterio que `detectarChoquesHorarioSedes` en /registro — es una
 *  ADVERTENCIA (no bloquea guardar), solo que acá sí se le avisa al
 *  médico (en /registro quedó como "NOT NOW" por falta de pantalla donde
 *  mostrarla después de crear la cuenta; acá esta misma pantalla ya tiene
 *  un slot de Alert para advertencias, ver advertenciaFoto). */
function mensajeChoques(choques: ChoqueHorario[]): string | undefined {
  if (choques.length === 0) return undefined;
  const primero = choques[0];
  const resto = choques.length - 1;
  const base = `${primero.sedeA} y ${primero.sedeB} se solapan el ${primero.dia} (${primero.horaInicioA}–${primero.horaFinA} vs. ${primero.horaInicioB}–${primero.horaFinB}).`;
  return resto > 0 ? `${base} Hay ${resto} choque(s) más entre tus sedes.` : base;
}

function vacio(valor: FormDataEntryValue | null): string | undefined {
  const texto = valor?.toString().trim();
  return texto ? texto : undefined;
}

// 10-nov-2026 (pedido del usuario: "si yo escribo vibra.ink eso debería
// bastar, no ser bloqueante"): el médico normalmente escribe solo el
// dominio (vibra.ink, www.vibra.ink) — anteponerle https:// acá es lo que
// hace que el enlace sea clicable en la ficha pública (vitalud lo imprime
// tal cual en un href). Si ya trae un protocolo (http:// o https://) se
// deja igual, nunca se lo duplica.
function normalizarSitioWeb(valor: string | undefined): string | null {
  if (!valor) return null;
  return /^https?:\/\//i.test(valor) ? valor : `https://${valor}`;
}

/**
 * Guarda los campos editables de "Mi ficha pública" y sincroniza TODO el
 * estado actual (no solo lo que cambió) con el Directorio — ver changelog
 * punto 75/76. A diferencia del registro (actions.ts de /registro), acá SÍ
 * se bloquea con el resultado real: el médico está mirando esta pantalla
 * para que la ficha quede bien, no tiene sentido fingir que se guardó.
 */
export async function guardarFichaPublicaAction(
  _previo: GuardarFichaPublicaResultado,
  formData: FormData,
): Promise<GuardarFichaPublicaResultado> {
  const { session, medico } = await requireMedicoSesion();

  const parseo = fichaPublicaSchema.safeParse({
    descripcion: vacio(formData.get("descripcion")),
    instagram: vacio(formData.get("instagram")),
    correo: vacio(formData.get("correo")),
    sitioWeb: vacio(formData.get("sitioWeb")),
    rif: vacio(formData.get("rif")),
    domicilioFiscal: vacio(formData.get("domicilioFiscal")),
    cedula: vacio(formData.get("cedula")),
    numeroColegiado: vacio(formData.get("numeroColegiado")),
    numeroMpps: vacio(formData.get("numeroMpps")),
    especialidad: vacio(formData.get("especialidad")),
    especialidadSecundaria1: vacio(formData.get("especialidadSecundaria1")),
    telefonoPublico: vacio(formData.get("telefonoPublico")),
  });
  if (!parseo.success) {
    return { ok: false, error: "Revisa los campos marcados — alguno quedó demasiado largo." };
  }

  const servicios = leerServiciosDeFormData(formData);
  const aseguradoras = leerAseguradorasDeFormData(formData);
  const zonasCoberturaForm = formData
    .getAll("zonasCobertura")
    .map(String)
    .filter((z) => (MUNICIPIOS_TRUJILLO as readonly string[]).includes(z));

  // 10-nov-2026: las modalidades ahora se editan en esta misma pantalla
  // (antes solo se fijaban una vez en /registro y nunca más se tocaban) —
  // vienen del form, no de lo que ya tenía guardado `Medico`.
  const modalidadesNuevas: ModalidadAtencionId[] = MODALIDADES_ATENCION.filter(
    (m) => formData.get(`modalidad_${m}`) === "on",
  );
  if (modalidadesNuevas.length === 0) {
    return { ok: false, error: "Marca al menos una forma en la que atiendes (presencial, a domicilio u online)." };
  }

  const [organizacion, medicoCompleto, sedesActuales] = await Promise.all([
    prisma.organizacion.findUniqueOrThrow({
      where: { id: session.user.organizacionId },
      select: { id: true, nombre: true, fichaDirectorioId: true },
    }),
    prisma.medico.findUniqueOrThrow({
      where: { id: medico.id },
      select: { profesion: true, numeroMpps: true, numeroColegiado: true, especialidad: true, telefonoPublico: true },
    }),
    prisma.sede.findMany({
      where: { medicoId: medico.id },
      select: { id: true, direccion: true, referencia: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // changelog punto 87: ya no hace falta mapear/validar la modalidad acá —
  // las tres booleanas viajan tal cual, cualquier combinación (incluida
  // solo ONLINE) es representable del lado del Directorio.
  const atiendePresencial = modalidadesNuevas.includes("PRESENCIAL");
  const atiendeDomicilio = modalidadesNuevas.includes("DOMICILIO");
  const atiendeOnline = modalidadesNuevas.includes("ONLINE");

  // 10-nov-2026 — mismo pedido ("donde edita un medico sedes horarios y
  // ubicaciones y modalidad de consultas"): cada sede ya creada se puede
  // editar o eliminar (`sedeOs_<id>_eliminar`), y se pueden agregar nuevas
  // (`sedeNueva1.._municipio` etc., hasta SEDES_MAX) — mismos nombres de
  // campo y misma validación que /registro, para reusar `leerSedeDeFormData`.
  const idsAEliminar = sedesActuales
    .filter((s) => formData.get(`sedeOs_${s.id}_eliminar`) === "on")
    .map((s) => s.id);
  const sedesMantenidas = sedesActuales.filter((s) => !idsAEliminar.includes(s.id));

  for (const sede of sedesMantenidas) {
    const editada = leerSedeDeFormData(formData, `sedeOs_${sede.id}`);
    if (!editada) {
      return { ok: false, error: "Completa municipio y dirección de todas tus sedes (o elimínalas)." };
    }
  }

  const espacioDisponible = Math.max(0, SEDES_MAX - sedesMantenidas.length);
  const sedesNuevas: ReturnType<typeof leerSedeDeFormData>[] = [];
  for (let i = 1; i <= SEDES_MAX && sedesNuevas.length < espacioDisponible; i++) {
    const nueva = leerSedeDeFormData(formData, `sedeNueva${i}`);
    if (nueva) sedesNuevas.push(nueva);
  }

  if (atiendePresencial && sedesMantenidas.length === 0 && sedesNuevas.length === 0) {
    return { ok: false, error: "Agrega al menos una sede para la modalidad presencial (o desmarca esa modalidad)." };
  }

  await prisma.$transaction(async (tx) => {
    if (idsAEliminar.length > 0) {
      await tx.sede.deleteMany({ where: { id: { in: idsAEliminar }, medicoId: medico.id } });
    }
    for (const sede of sedesMantenidas) {
      const editada = leerSedeDeFormData(formData, `sedeOs_${sede.id}`)!;
      await tx.sede.update({
        where: { id: sede.id },
        data: {
          municipio: editada.municipio,
          direccion: editada.direccion,
          referencia: editada.referencia,
          horario: editada.horario as unknown as Prisma.InputJsonValue,
        },
      });
    }
    for (const nueva of sedesNuevas) {
      await tx.sede.create({
        data: {
          medicoId: medico.id,
          organizacionId: organizacion.id,
          municipio: nueva!.municipio,
          direccion: nueva!.direccion,
          referencia: nueva!.referencia,
          horario: nueva!.horario as unknown as Prisma.InputJsonValue,
        },
      });
    }
  });

  // Se recarga completa (no se arma a mano con lo de arriba) porque las
  // sedes nuevas recién ahí consiguen su `id` real — hace falta para
  // emparejar `ciudadSede_<id>` más abajo y para pintar la pantalla si
  // esto se re-renderizara sin recargar.
  const sedesFinal = await prisma.sede.findMany({
    where: { medicoId: medico.id },
    select: { id: true, direccion: true, referencia: true, horario: true },
    orderBy: { createdAt: "asc" },
  });

  const advertenciaChoques = mensajeChoques(
    detectarChoquesHorarioSedes(
      sedesFinal.map((s) => ({ nombre: s.direccion, horario: s.horario as unknown as HorarioDia[] })),
    ),
  );

  // 10-nov-2026: cédula, MPPS, colegiado, especialidad secundaria y zonas
  // de cobertura ya no se piden en el registro — este formulario es ahora
  // la única pantalla donde se persisten en `Medico` (antes acá solo se
  // LEÍAN de `medicoCompleto` para sincronizar, nunca se escribían).
  const numeroMppsNuevo =
    medicoCompleto.profesion === "MEDICO" ? parseo.data.numeroMpps ?? null : null;
  const zonasCoberturaNuevas = atiendeDomicilio ? zonasCoberturaForm : [];
  const especialidadNueva = parseo.data.especialidad ?? null;
  const especialidadesSecundariasNuevas = parseo.data.especialidadSecundaria1
    ? [parseo.data.especialidadSecundaria1]
    : [];
  // 10-nov-2026: un único WhatsApp por médico, ya no uno por sede (ver
  // nota en fichaPublicaSchema) — se persiste acá como el resto de los
  // campos de "Mi ficha pública" y se manda igual a cada sede del
  // Directorio más abajo.
  const telefonoPublicoNuevo = parseo.data.telefonoPublico ?? null;

  await prisma.medico.update({
    where: { id: medico.id },
    data: {
      cedula: parseo.data.cedula ?? null,
      numeroColegiado: parseo.data.numeroColegiado ?? null,
      numeroMpps: numeroMppsNuevo,
      especialidad: especialidadNueva,
      especialidadesSecundarias: especialidadesSecundariasNuevas,
      zonasCobertura: zonasCoberturaNuevas,
      modalidades: modalidadesNuevas,
      telefonoPublico: telefonoPublicoNuevo,
    },
  });

  // Cada sede necesita una ciudad REAL del Directorio (catálogo distinto al
  // municipio de Trujillo que ya tiene cada Sede — ver sincronizacion.ts).
  // El formulario manda un campo `ciudadSede_<id>` por cada sede del OS.
  type SedeOs = { id: string; direccion: string; referencia: string | null; horario: Prisma.JsonValue };
  type SedeConCiudad = {
    ciudadId: string;
    direccion: string;
    // 10-nov-2026: antes el Directorio no tenía estas dos columnas — la
    // ficha caía a mostrar solo la dirección. `consultorioSede_<id>` y
    // `sectorSede_<id>` son nuevos en FichaPublicaForm.tsx.
    consultorio: string | null;
    sector: string | null;
    referencia: string | null;
    // El Directorio sigue guardando `telefono` por sede (no se le tocó el
    // esquema/gateo) — acá se manda el MISMO WhatsApp del médico en cada
    // una, en vez de uno distinto por sede (ver telefonoPublicoNuevo).
    telefono: string | null;
    lat: number | null;
    lng: number | null;
    horario: Array<{ diaSemana: number; horaInicio: string; horaFin: string }>;
  };

  // El picker de mapa manda `lat_<id>`/`lng_<id>` como string numérico solo
  // cuando el médico marcó un punto — ausentes o vacíos quedan en null (el
  // punto exacto es opcional, la ciudad ya alcanza para listar la sede).
  function coordenada(valor: FormDataEntryValue | null): number | null {
    const texto = valor?.toString().trim();
    if (!texto) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
  }

  const sedesConCiudad = sedesFinal
    .map((sede: SedeOs): SedeConCiudad | null => {
      const ciudadId = vacio(formData.get(`ciudadSede_${sede.id}`));
      if (!ciudadId) return null;
      return {
        ciudadId,
        direccion: sede.direccion,
        consultorio: vacio(formData.get(`consultorioSede_${sede.id}`)) ?? null,
        sector: vacio(formData.get(`sectorSede_${sede.id}`)) ?? null,
        referencia: sede.referencia,
        telefono: telefonoPublicoNuevo,
        lat: coordenada(formData.get(`lat_${sede.id}`)),
        lng: coordenada(formData.get(`lng_${sede.id}`)),
        horario: horarioParaDirectorio(sede.horario as unknown as HorarioDia[]),
      };
    })
    .filter((s: SedeConCiudad | null): s is SedeConCiudad => s !== null);

  if (atiendePresencial && sedesConCiudad.length === 0 && sedesFinal.length > 0) {
    return {
      ok: false,
      error: "Elige la ciudad del Directorio para al menos una de tus sedes antes de guardar.",
    };
  }

  // La foto ya no se edita como texto (ver changelog punto 86) — este POST
  // sigue necesitando MANDAR el valor actual de foto_url, o el Directorio
  // la pondría en null en cada guardado de los demás campos. La subida de
  // una foto nueva (si llegó un archivo) pasa aparte, DESPUÉS de este sync,
  // porque necesita un fichaDirectorioId real (lo crea este mismo llamado
  // si todavía no existía).
  const directorioActual = await obtenerFichaDirectorio(organizacion.fichaDirectorioId);
  const fotoUrlActual = directorioActual.ok ? directorioActual.ficha?.foto_url ?? null : null;

  const resultado = await sincronizarFichaDirectorio({
    fichaDirectorioId: organizacion.fichaDirectorioId,
    nombre: organizacion.nombre,
    profesion: medicoCompleto.profesion,
    numeroMpps: numeroMppsNuevo,
    numeroColegiado: parseo.data.numeroColegiado ?? null,
    atiendePresencial,
    atiendeDomicilio,
    atiendeOnline,
    zonasCobertura: zonasCoberturaNuevas,
    sedes: sedesConCiudad,
    fotoUrl: fotoUrlActual,
    descripcion: parseo.data.descripcion ?? null,
    instagram: parseo.data.instagram ?? null,
    correo: parseo.data.correo ?? null,
    sitioWeb: normalizarSitioWeb(parseo.data.sitioWeb),
    rif: parseo.data.rif ?? null,
    domicilioFiscal: parseo.data.domicilioFiscal ?? null,
    servicios,
    aseguradoras,
    // 10-nov-2026: usa el valor recién guardado en este mismo submit (no
    // `medicoCompleto.especialidad`, que es el de ANTES de este guardado) —
    // si no hay match exacto en el catálogo del Directorio, la ficha queda
    // sin especialidad ahí, no bloquea guardar.
    especialidadId: resolverEspecialidadId(
      especialidadNueva,
      directorioActual.ok ? directorioActual.especialidades : [],
    ),
  });

  if (!resultado.ok) {
    return { ok: false, error: resultado.error };
  }

  await prisma.organizacion.update({
    where: { id: organizacion.id },
    data: {
      fichaDirectorioId: resultado.id,
      fichaDirectorioSlug: resultado.slug,
      fichaDirectorioSincronizada: true,
    },
  });

  // Foto nueva: el input oculto solo trae un archivo si RecortadorFoto
  // confirmó un recorte en esta misma carga del form (ver
  // FichaPublicaForm.tsx) — subirFotoDirectorio aplica foto_url directo en
  // el Directorio, no hace falta un segundo sync completo para eso.
  const archivoFoto = formData.get("foto");
  let advertenciaFoto: string | undefined;
  if (archivoFoto instanceof File && archivoFoto.size > 0) {
    const subida = await subirFotoDirectorio(resultado.id, archivoFoto);
    if (!subida.ok) advertenciaFoto = subida.error;
  }

  return { ok: true, slug: resultado.slug, advertenciaFoto, advertenciaChoques };
}

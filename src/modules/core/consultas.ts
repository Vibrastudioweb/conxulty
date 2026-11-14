import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { registrarEvento } from "@/modules/trazabilidad";
import { validarConsistenciaConsulta } from "@/db/consistenciaOrganizacional";
import { PacienteArchivadoError } from "@/modules/core/pacientes";

export class ConsultaNoEncontradaError extends Error {
  constructor() {
    super("La consulta no existe o no pertenece a esta organización.");
    this.name = "ConsultaNoEncontradaError";
  }
}

export class CitaNoEncontradaError extends Error {
  constructor() {
    super("La cita no existe o no pertenece a esta organización.");
    this.name = "CitaNoEncontradaError";
  }
}

export class EstadoConsultaInvalidoError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "EstadoConsultaInvalidoError";
  }
}

export class CitaNoDisponibleError extends Error {
  constructor() {
    super("No se puede iniciar una consulta a partir de una cita cancelada o no asistida.");
    this.name = "CitaNoDisponibleError";
  }
}

const CAMPOS_CLINICOS = [
  "motivoConsulta",
  "anamnesis",
  "antecedentes",
  "examenFisico",
  "evaluacion",
  "diagnostico",
  "tratamiento",
] as const;

type CampoClinico = (typeof CAMPOS_CLINICOS)[number];
export type CamposClinicos = Partial<Record<CampoClinico, string | null>>;

/**
 * Signos vitales de la consulta (29-oct-2026 — ver changelog de la demo,
 * punto 6; campos agregados al esquema real en este mismo cambio). Van
 * aparte de CAMPOS_CLINICOS porque son numéricos/Decimal, no texto: no
 * tiene sentido reutilizar la misma comparación `nuevo !== actual` que usa
 * guardarConsulta para los campos de texto (un Decimal de Prisma nunca es
 * `===` a un number aunque representen el mismo valor), así que estos se
 * escriben directo cuando la clave viene presente en el input, sin
 * optimizar por diff.
 */
const CAMPOS_VITALES = [
  "presionArterial",
  "frecuenciaCardiaca",
  "temperatura",
  "saturacionOxigeno",
  "pesoKg",
  "tallaCm",
] as const;

type CampoVital = (typeof CAMPOS_VITALES)[number];
export type CamposVitales = Partial<{
  presionArterial: string | null;
  frecuenciaCardiaca: number | null;
  temperatura: number | null;
  saturacionOxigeno: number | null;
  pesoKg: number | null;
  tallaCm: number | null;
}>;

export async function obtenerConsulta(input: {
  organizacionId: string;
  consultaId: string;
}) {
  return prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    include: {
      paciente: { select: { nombre: true, apellido: true } },
      // Necesario para resolver la Plantilla por especialidad (puntos
      // 37-40/49) — se resuelve por profesión/especialidad del médico DUEÑO
      // de la consulta, no del médico que la está viendo.
      medico: { select: { profesion: true, especialidad: true } },
    },
  });
}

/**
 * Historia clínica longitudinal: todas las consultas de un paciente dentro
 * de la organización, más recientes primero. Nunca se filtra solo por
 * pacienteId — organizacionId siempre va en el where, para que un paciente
 * de otra organización nunca pueda resolverse aquí.
 *
 * Devuelve un resumen (fecha, estado, motivo, diagnóstico, médico), no el
 * contenido clínico completo — ese sigue viviendo únicamente en
 * obtenerConsulta/`/consultas/[id]`. El nombre del médico se expone porque
 * la relación Consulta -> Medico -> Usuario ya existe en el schema; no se
 * inventa ninguna relación nueva.
 */
export async function listarConsultasDelPaciente(input: {
  organizacionId: string;
  pacienteId: string;
}) {
  return prisma.consulta.findMany({
    where: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
    },
    select: {
      id: true,
      fechaHora: true,
      estado: true,
      motivoConsulta: true,
      diagnostico: true,
      tratamiento: true,
      presionArterial: true,
      frecuenciaCardiaca: true,
      temperatura: true,
      saturacionOxigeno: true,
      pesoKg: true,
      tallaCm: true,
      medicoId: true,
      medico: {
        select: {
          usuario: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fechaHora: "desc" },
  });
}

/**
 * Si la Cita ya tiene una Consulta, la reutiliza (nunca duplica: Consulta.citaId
 * es @unique en el schema). Si no, valida consistencia entre organizaciones
 * antes de crear. Cuando citaId viene informado, el medicoId efectivo de la
 * Consulta es el de la propia Cita (no el del médico que hace clic), para que
 * Consulta.medicoId nunca quede inconsistente con Cita.medicoId. Para walk-in
 * (sin citaId) se usa el médico de la sesión.
 */
export async function abrirOCrearConsulta(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  pacienteId: string;
  citaId?: string | null;
}): Promise<{ consultaId: string; creada: boolean }> {
  let medicoEfectivo = input.medicoId;

  if (input.citaId) {
    const cita = await prisma.cita.findFirst({
      where: { id: input.citaId, organizacionId: input.organizacionId },
      include: { consulta: { select: { id: true } } },
    });

    if (!cita) {
      throw new CitaNoEncontradaError();
    }

    // La cita tiene que ser de ESTE paciente. Antes solo se comprobaba que
    // fuera de la misma organización: se podía crear la consulta de un
    // paciente colgada de la cita de otro, y al cerrarla la cita ajena
    // quedaba como atendida.
    if (cita.pacienteId !== input.pacienteId) {
      throw new CitaNoEncontradaError();
    }

    if (cita.consulta) {
      return { consultaId: cita.consulta.id, creada: false };
    }

    if (cita.estado === "CANCELADA" || cita.estado === "NO_ASISTIO") {
      throw new CitaNoDisponibleError();
    }

    medicoEfectivo = cita.medicoId;
  }

  // Sin cita: si este médico ya tiene una consulta EN CURSO de este paciente
  // abierta HOY, se continúa esa. Antes cada clic en "Iniciar consulta" o
  // "Recetar" creaba una nueva —un doble clic, o volver atrás y pulsar otra
  // vez, dejaba consultas vacías duplicadas en la historia— aunque los
  // comentarios de las acciones prometían lo contrario.
  //
  // Solo las de hoy: una consulta que quedó abierta hace semanas es otra
  // visita, y meter la de hoy ahí mezclaría dos atenciones en una nota.
  if (!input.citaId) {
    const inicioDeHoy = new Date();
    inicioDeHoy.setHours(0, 0, 0, 0);
    const enCurso = await prisma.consulta.findFirst({
      where: {
        organizacionId: input.organizacionId,
        pacienteId: input.pacienteId,
        medicoId: medicoEfectivo,
        estado: "EN_CURSO",
        citaId: null,
        createdAt: { gte: inicioDeHoy },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (enCurso) {
      return { consultaId: enCurso.id, creada: false };
    }
  }

  // Continuar una consulta EN_CURSO ya existente (retornos arriba) nunca se
  // bloquea aunque el paciente se archive después; solo se bloquea INICIAR
  // una consulta nueva — igual que crearCita en modules/core/citas.ts.
  // findFirst con organizacionId, como exige el resto del módulo.
  const paciente = await prisma.paciente.findFirst({
    where: { id: input.pacienteId, organizacionId: input.organizacionId },
    select: { activo: true },
  });
  if (!paciente?.activo) {
    throw new PacienteArchivadoError();
  }

  await validarConsistenciaConsulta({
    organizacionId: input.organizacionId,
    pacienteId: input.pacienteId,
    medicoId: medicoEfectivo,
    citaId: input.citaId ?? null,
  });

  const consulta = await prisma.consulta.create({
    data: {
      organizacionId: input.organizacionId,
      pacienteId: input.pacienteId,
      medicoId: medicoEfectivo,
      citaId: input.citaId ?? null,
    },
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "crear_consulta",
    entidadTipo: "Consulta",
    entidadId: consulta.id,
    pacienteId: input.pacienteId,
  });

  return { consultaId: consulta.id, creada: true };
}

/**
 * Solo permitido si la consulta está EN_CURSO. No cambia el estado ni toca
 * la Cita. Registra en trazabilidad únicamente los NOMBRES de los campos que
 * realmente cambiaron (comparado contra el valor previo), nunca el contenido.
 */
export async function guardarConsulta(input: {
  organizacionId: string;
  actorId: string;
  consultaId: string;
  campos: CamposClinicos;
  vitales?: CamposVitales;
  /** Campos de la Plantilla por especialidad — ver changelog punto 49. Un
   * objeto vacío se guarda como `null` (nada que mostrar), no como `{}`. */
  camposEspecialidad?: Record<string, string> | null;
}): Promise<void> {
  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: {
      estado: true,
      pacienteId: true,
      motivoConsulta: true,
      anamnesis: true,
      antecedentes: true,
      examenFisico: true,
      evaluacion: true,
      diagnostico: true,
      tratamiento: true,
      camposEspecialidad: true,
    },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }
  if (consulta.estado !== "EN_CURSO") {
    throw new EstadoConsultaInvalidoError(
      "Solo se puede guardar una consulta que está en curso.",
    );
  }

  const camposModificados = CAMPOS_CLINICOS.filter((campo) => {
    const nuevo = input.campos[campo];
    return nuevo !== undefined && nuevo !== consulta[campo];
  });

  const data: Partial<Record<CampoClinico, string | null>> &
    CamposVitales & {
      // Prisma modela un campo Json nulo con `Prisma.JsonNull`, no con el
      // `null` de JS — por eso el tipo acá no es `Record<...> | null`
      // directo (ver asignación más abajo, donde se hace la conversión).
      camposEspecialidad?: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    } = {};
  for (const campo of camposModificados) {
    data[campo] = input.campos[campo] ?? null;
  }

  const vitalesModificados: CampoVital[] = [];
  if (input.vitales) {
    for (const campo of CAMPOS_VITALES) {
      // `!== undefined`, no `in`: la acción arma el objeto con las seis
      // claves siempre, y un valor ausente o no numérico llega como
      // `undefined`. Con `in` eso se escribía como null y BORRABA el signo
      // vital ya guardado — al revés de lo que promete leerCampoNumerico.
      if (input.vitales[campo] !== undefined) {
        // Asignación "a ciegas" deliberada: `campo` es un CampoVital (unión),
        // y TS no correlaciona el tipo de valor de `input.vitales[campo]`
        // con la clave en un loop genérico, aunque en runtime SÍ coincide
        // campo a campo con CamposVitales (ver definición más arriba).
        (data as Record<CampoVital, string | number | null>)[campo] =
          input.vitales[campo] ?? null;
        vitalesModificados.push(campo);
      }
    }
  }

  let camposEspecialidadModificado = false;
  if (input.camposEspecialidad !== undefined) {
    const nuevo =
      input.camposEspecialidad && Object.keys(input.camposEspecialidad).length > 0
        ? input.camposEspecialidad
        : null;
    if (JSON.stringify(nuevo) !== JSON.stringify(consulta.camposEspecialidad ?? null)) {
      data.camposEspecialidad = nuevo === null ? Prisma.JsonNull : nuevo;
      camposEspecialidadModificado = true;
    }
  }

  if (
    camposModificados.length === 0 &&
    vitalesModificados.length === 0 &&
    !camposEspecialidadModificado
  ) {
    return;
  }

  const resultado = await prisma.consulta.updateMany({
    where: {
      id: input.consultaId,
      organizacionId: input.organizacionId,
      estado: "EN_CURSO",
    },
    data,
  });

  if (resultado.count !== 1) {
    throw new EstadoConsultaInvalidoError(
      "La consulta cambió de estado antes de poder guardarse.",
    );
  }

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "modificar_consulta",
    entidadTipo: "Consulta",
    entidadId: input.consultaId,
    pacienteId: consulta.pacienteId,
    cambios: {
      camposModificados: [
        ...camposModificados,
        ...vitalesModificados,
        ...(camposEspecialidadModificado ? ["camposEspecialidad"] : []),
      ],
    },
  });
}

/**
 * Anula una consulta abierta por error (13-nov-2026, auditoría del núcleo
 * clínico).
 *
 * EL HUECO QUE CIERRA: el estado ANULADA existía en el enum y la interfaz
 * ya sabía pintarlo y bloquear documentos sobre él, pero NADA en el
 * sistema lo producía. Era un estado muerto. Y el error que debía cubrir
 * es de los fáciles de cometer: desde la ficha de un paciente, "Iniciar
 * consulta" es un clic, y la lista es alfabética con apellidos que se
 * repiten. Una consulta abierta en el paciente equivocado se quedaba para
 * siempre en la historia clínica de alguien que nunca fue atendido.
 *
 * SOLO DESDE EN_CURSO, a propósito. Una consulta cerrada es historia
 * clínica: no se borra ni se invalida a posteriori, igual que no se
 * arranca una hoja de un expediente. El error que esto arregla se nota en
 * el momento —el médico ve el nombre equivocado arriba— y ahí todavía
 * está EN_CURSO.
 *
 * El motivo es obligatorio: "anulada" sin decir por qué no le sirve a
 * nadie que lea esa historia después.
 *
 * Arrastra los documentos emitidos sobre ella. Si la consulta no existió,
 * sus recetas tampoco valen, y dejarlas vivas sería dejar una receta
 * válida colgando de una consulta anulada.
 */
export async function anularConsulta(input: {
  organizacionId: string;
  actorId: string;
  consultaId: string;
  motivo: string;
}): Promise<void> {
  const motivo = input.motivo.trim();
  if (!motivo) {
    throw new EstadoConsultaInvalidoError("Hay que decir por qué se anula la consulta.");
  }

  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: { estado: true, pacienteId: true, citaId: true },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }
  if (consulta.estado !== "EN_CURSO") {
    throw new EstadoConsultaInvalidoError(
      consulta.estado === "CERRADA"
        ? "Una consulta cerrada ya es parte de la historia clínica: no se anula."
        : "Esta consulta ya está anulada.",
    );
  }

  const anuladoEn = new Date();

  await prisma.$transaction(async (tx) => {
    // Mismo control de concurrencia que cerrarConsulta: si cambió de
    // estado entre la lectura y esta escritura, actualiza 0 filas.
    const resultado = await tx.consulta.updateMany({
      where: {
        id: input.consultaId,
        organizacionId: input.organizacionId,
        estado: "EN_CURSO",
      },
      // Se suelta la cita. `citaId` es único, así que si la anulada se la
      // quedaba, "Iniciar consulta" desde esa cita devolvía para siempre la
      // consulta anulada (de solo lectura) y el paciente ya no podía ser
      // atendido por su cita. Cuál era queda en la auditoría, más abajo.
      data: { estado: "ANULADA", citaId: null },
    });

    if (resultado.count !== 1) {
      throw new EstadoConsultaInvalidoError(
        "La consulta cambió de estado antes de poder anularse.",
      );
    }

    await tx.documento.updateMany({
      where: {
        consultaId: input.consultaId,
        organizacionId: input.organizacionId,
        anuladoEn: null,
      },
      data: { anuladoEn, motivoAnulacion: "Se anuló la consulta: " + motivo },
    });
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "anular_consulta",
    entidadTipo: "Consulta",
    entidadId: input.consultaId,
    pacienteId: consulta.pacienteId,
    cambios: { motivo, ...(consulta.citaId ? { citaLiberada: consulta.citaId } : {}) },
  });
}

/**
 * Solo permitido si la consulta está EN_CURSO. Cambia Consulta -> CERRADA y,
 * si tiene citaId, Cita -> ATENDIDA, en una única transacción (si una falla,
 * ninguna queda modificada). Una consulta CERRADA o ANULADA no puede volver
 * a cerrarse.
 */
export async function cerrarConsulta(input: {
  organizacionId: string;
  actorId: string;
  consultaId: string;
}): Promise<void> {
  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: { estado: true, pacienteId: true, citaId: true },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }
  if (consulta.estado !== "EN_CURSO") {
    throw new EstadoConsultaInvalidoError(
      "Solo se puede cerrar una consulta que está en curso.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const resultadoConsulta = await tx.consulta.updateMany({
      where: {
        id: input.consultaId,
        organizacionId: input.organizacionId,
        estado: "EN_CURSO",
      },
      data: { estado: "CERRADA" },
    });

    if (resultadoConsulta.count !== 1) {
      throw new EstadoConsultaInvalidoError(
        "La consulta cambió de estado antes de poder cerrarse.",
      );
    }

    if (consulta.citaId) {
      const resultadoCita = await tx.cita.updateMany({
        where: { id: consulta.citaId, organizacionId: input.organizacionId },
        data: { estado: "ATENDIDA" },
      });

      if (resultadoCita.count !== 1) {
        throw new CitaNoEncontradaError();
      }
    }
  });

  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "cerrar_consulta",
    entidadTipo: "Consulta",
    entidadId: input.consultaId,
    pacienteId: consulta.pacienteId,
  });

  if (consulta.citaId) {
    await registrarEvento({
      organizacionId: input.organizacionId,
      actorId: input.actorId,
      accion: "marcar_atendida",
      entidadTipo: "Cita",
      entidadId: consulta.citaId,
      pacienteId: consulta.pacienteId,
    });
  }
}

/**
 * Nota aclaratoria sobre una consulta CERRADA (13-nov-2026, segunda
 * revisión del núcleo clínico).
 *
 * Una consulta cerrada no se edita: es historia clínica. Pero cerrar con
 * un error en el diagnóstico no puede ser un callejón sin salida. La
 * salida honesta es la de un expediente en papel: no se tacha lo escrito,
 * se agrega una nota con fecha y autor que diga qué estaba mal.
 *
 * Solo se crean. No se editan ni se borran: una aclaración que se puede
 * reescribir no aclara nada.
 */
export async function agregarNotaAclaratoria(input: {
  organizacionId: string;
  actorId: string;
  medicoId: string;
  consultaId: string;
  texto: string;
}): Promise<void> {
  const texto = input.texto.trim();
  if (!texto) {
    throw new EstadoConsultaInvalidoError("La nota aclaratoria no puede estar vacía.");
  }

  const consulta = await prisma.consulta.findFirst({
    where: { id: input.consultaId, organizacionId: input.organizacionId },
    select: { estado: true, pacienteId: true },
  });

  if (!consulta) {
    throw new ConsultaNoEncontradaError();
  }
  // En curso se corrige editando; anulada no es una atención que aclarar.
  if (consulta.estado !== "CERRADA") {
    throw new EstadoConsultaInvalidoError(
      "Solo se agregan notas aclaratorias a una consulta cerrada.",
    );
  }

  const nota = await prisma.notaAclaratoria.create({
    data: {
      organizacionId: input.organizacionId,
      consultaId: input.consultaId,
      medicoId: input.medicoId,
      texto,
    },
  });

  // Como en el resto de la auditoría clínica: qué pasó, nunca el contenido.
  await registrarEvento({
    organizacionId: input.organizacionId,
    actorId: input.actorId,
    accion: "agregar_nota_aclaratoria",
    entidadTipo: "Consulta",
    entidadId: input.consultaId,
    pacienteId: consulta.pacienteId,
    cambios: { notaId: nota.id },
  });
}

export async function listarNotasAclaratorias(input: {
  organizacionId: string;
  consultaId: string;
}) {
  return prisma.notaAclaratoria.findMany({
    where: { organizacionId: input.organizacionId, consultaId: input.consultaId },
    orderBy: { createdAt: "asc" },
    select: { id: true, texto: true, createdAt: true },
  });
}

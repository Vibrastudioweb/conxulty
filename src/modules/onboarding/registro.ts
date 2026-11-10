import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { EmailYaRegistradoError } from "@/modules/acceso/solicitudes";
import { type ProfesionId, esProfesionElegiblePro } from "@/modules/onboarding/profesiones";
import { type ModalidadAtencionId } from "@/modules/onboarding/modalidades";
import { type HorarioDia, detectarChoquesHorarioSedes, type ChoqueHorario } from "@/modules/onboarding/horarioSede";

export class ProfesionOtraTextoRequeridoError extends Error {
  constructor() {
    super('Falta especificar la profesión cuando se elige "Otra".');
    this.name = "ProfesionOtraTextoRequeridoError";
  }
}

export interface SedeInput {
  municipio: string;
  direccion: string;
  referencia?: string | null;
  telefono?: string | null;
  horario: HorarioDia[];
}

export interface RegistrarMedicoInput {
  nombre: string;
  email: string;
  /** Texto plano — se hashea acá, nunca se persiste en claro. */
  password: string;
  profesion: ProfesionId;
  profesionOtraTexto?: string | null;
  cedula?: string | null;
  numeroColegiado?: string | null;
  /** Solo relevante si `profesion` = MEDICO — ver changelog punto 29. */
  numeroMpps?: string | null;
  especialidad?: string | null;
  especialidadesSecundarias?: string[];
  modalidades: ModalidadAtencionId[];
  zonasCobertura?: string[];
  sedes: SedeInput[];
  /** Si el médico eligió Pro pero su profesión no es elegible, se fuerza FICHA. */
  planElegido: "FICHA" | "PRO";
}

/**
 * Registro self-service de un médico — ver changelog punto 49 (Bloque 3).
 * Crea Organizacion + Usuario (rol MEDICO) + Medico + Sede[] en una sola
 * transacción. Reemplaza, para este camino, el flujo asistido de
 * SolicitudAcceso/superadmin (que sigue existiendo para altas con
 * contacto directo — no se tocó ni se eliminó).
 *
 * Validaciones de negocio: solo el motivo de "Otra" profesión bloquea acá
 * — el shape/formato de los campos se valida antes, en la Server Action.
 * El choque de horario entre sedes (changelog punto 33) es una
 * ADVERTENCIA, no bloquea el registro — se devuelve en el resultado para
 * mostrarla después de crear la cuenta.
 *
 * 10-nov-2026, pedido del usuario ("quiero hacer súper sencillo el
 * registro inicial y poner todo lo demás en mi ficha"): modalidad,
 * especialidad, sedes/horario y zonas de cobertura ya NO son obligatorias
 * acá (antes `ModalidadRequeridaError`/`SedeRequeridaError` bloqueaban
 * crear la cuenta) — todo eso se completa después en "Mi ficha pública",
 * que ya tiene su propia validación antes de publicar (ver
 * `guardarFichaPublicaAction`). Una cuenta nueva puede quedar con
 * `modalidades: []` y sin sedes hasta que el médico entre ahí.
 */
export async function registrarMedico(
  input: RegistrarMedicoInput,
): Promise<{ usuarioId: string; organizacionId: string; choques: ChoqueHorario[] }> {
  if (input.profesion === "OTRA" && !input.profesionOtraTexto?.trim()) {
    throw new ProfesionOtraTextoRequeridoError();
  }

  const planFinal: "FICHA" | "PRO" =
    input.planElegido === "PRO" && esProfesionElegiblePro(input.profesion) ? "PRO" : "FICHA";

  const passwordHash = await bcrypt.hash(input.password, 10);

  const choques = detectarChoquesHorarioSedes(
    input.sedes.map((sede, i) => ({ nombre: sede.direccion || `Sede ${i + 1}`, horario: sede.horario })),
  );

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const organizacion = await tx.organizacion.create({
        data: { nombre: input.nombre, plan: planFinal },
        select: { id: true },
      });

      const usuario = await tx.usuario.create({
        data: {
          organizacionId: organizacion.id,
          nombre: input.nombre,
          email: input.email,
          passwordHash,
          rol: "MEDICO",
        },
        select: { id: true },
      });

      const medico = await tx.medico.create({
        data: {
          usuarioId: usuario.id,
          organizacionId: organizacion.id,
          especialidad: input.especialidad?.trim() || null,
          especialidadesSecundarias: (input.especialidadesSecundarias ?? []).filter(Boolean),
          numeroColegiado: input.numeroColegiado?.trim() || null,
          profesion: input.profesion,
          profesionOtraTexto: input.profesion === "OTRA" ? input.profesionOtraTexto!.trim() : null,
          cedula: input.cedula?.trim() || null,
          numeroMpps: input.profesion === "MEDICO" ? input.numeroMpps?.trim() || null : null,
          modalidades: input.modalidades,
          zonasCobertura: input.modalidades.includes("DOMICILIO") ? (input.zonasCobertura ?? []) : [],
        },
        select: { id: true },
      });

      if (input.modalidades.includes("PRESENCIAL")) {
        for (const sede of input.sedes) {
          await tx.sede.create({
            data: {
              medicoId: medico.id,
              organizacionId: organizacion.id,
              municipio: sede.municipio,
              direccion: sede.direccion,
              referencia: sede.referencia?.trim() || null,
              telefono: sede.telefono?.trim() || null,
              horario: sede.horario as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }

      return { usuarioId: usuario.id, organizacionId: organizacion.id };
    });

    return { ...resultado, choques };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailYaRegistradoError();
    }
    throw err;
  }
}

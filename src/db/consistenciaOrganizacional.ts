import { prisma } from "@/db/client";

/**
 * Capa de repositorio central para garantizar el aislamiento entre
 * organizaciones. Cualquier caso de uso que escriba Cita, Consulta, Cobro o
 * MovimientoCaja debe llamar a la función correspondiente antes de persistir,
 * para evitar que una entidad relacionada (Paciente, Médico, Cita, Consulta,
 * Cobro, Caja) de OTRA organización termine referenciada por error.
 *
 * No implementa casos de uso: solo valida. Falla de forma segura — si la
 * entidad relacionada no existe o pertenece a otra organización, lanza
 * InconsistenciaOrganizacionalError y la escritura debe abortarse.
 */

export class InconsistenciaOrganizacionalError extends Error {
  constructor(
    public readonly entidad: string,
    public readonly entidadId: string,
  ) {
    super(
      `La entidad "${entidad}" (${entidadId}) no existe o no pertenece a la organización esperada.`,
    );
    this.name = "InconsistenciaOrganizacionalError";
  }
}

function verificarOrganizacion(
  entidad: string,
  entidadId: string,
  organizacionIdEncontrado: string | null | undefined,
  organizacionIdEsperado: string,
): void {
  if (organizacionIdEncontrado !== organizacionIdEsperado) {
    throw new InconsistenciaOrganizacionalError(entidad, entidadId);
  }
}

/** Cita -> Paciente + Médico */
export async function validarConsistenciaCita(input: {
  organizacionId: string;
  pacienteId: string;
  medicoId: string;
}): Promise<void> {
  const [paciente, medico] = await Promise.all([
    prisma.paciente.findUnique({
      where: { id: input.pacienteId },
      select: { organizacionId: true },
    }),
    prisma.medico.findUnique({
      where: { id: input.medicoId },
      select: { organizacionId: true },
    }),
  ]);

  verificarOrganizacion(
    "Paciente",
    input.pacienteId,
    paciente?.organizacionId,
    input.organizacionId,
  );
  verificarOrganizacion(
    "Medico",
    input.medicoId,
    medico?.organizacionId,
    input.organizacionId,
  );
}

/** Consulta -> Paciente + Médico + Cita (opcional) */
export async function validarConsistenciaConsulta(input: {
  organizacionId: string;
  pacienteId: string;
  medicoId: string;
  citaId?: string | null;
}): Promise<void> {
  await validarConsistenciaCita({
    organizacionId: input.organizacionId,
    pacienteId: input.pacienteId,
    medicoId: input.medicoId,
  });

  if (input.citaId) {
    const cita = await prisma.cita.findUnique({
      where: { id: input.citaId },
      select: { organizacionId: true },
    });
    verificarOrganizacion(
      "Cita",
      input.citaId,
      cita?.organizacionId,
      input.organizacionId,
    );
  }
}

/** Documento -> Consulta + Médico */
export async function validarConsistenciaDocumento(input: {
  organizacionId: string;
  consultaId: string;
  medicoId: string;
}): Promise<void> {
  const [consulta, medico] = await Promise.all([
    prisma.consulta.findUnique({
      where: { id: input.consultaId },
      select: { organizacionId: true },
    }),
    prisma.medico.findUnique({
      where: { id: input.medicoId },
      select: { organizacionId: true },
    }),
  ]);

  verificarOrganizacion(
    "Consulta",
    input.consultaId,
    consulta?.organizacionId,
    input.organizacionId,
  );
  verificarOrganizacion(
    "Medico",
    input.medicoId,
    medico?.organizacionId,
    input.organizacionId,
  );
}

/** Cobro -> Consulta (opcional) + Paciente + Médico */
export async function validarConsistenciaCobro(input: {
  organizacionId: string;
  pacienteId: string;
  medicoId: string;
  consultaId?: string | null;
}): Promise<void> {
  const [paciente, medico] = await Promise.all([
    prisma.paciente.findUnique({
      where: { id: input.pacienteId },
      select: { organizacionId: true },
    }),
    prisma.medico.findUnique({
      where: { id: input.medicoId },
      select: { organizacionId: true },
    }),
  ]);

  verificarOrganizacion(
    "Paciente",
    input.pacienteId,
    paciente?.organizacionId,
    input.organizacionId,
  );
  verificarOrganizacion(
    "Medico",
    input.medicoId,
    medico?.organizacionId,
    input.organizacionId,
  );

  if (input.consultaId) {
    const consulta = await prisma.consulta.findUnique({
      where: { id: input.consultaId },
      select: { organizacionId: true },
    });
    verificarOrganizacion(
      "Consulta",
      input.consultaId,
      consulta?.organizacionId,
      input.organizacionId,
    );
  }
}

/** MovimientoCaja -> Caja + Cobro (opcional) */
export async function validarConsistenciaMovimientoCaja(input: {
  organizacionId: string;
  cajaId: string;
  cobroId?: string | null;
}): Promise<void> {
  const caja = await prisma.caja.findUnique({
    where: { id: input.cajaId },
    select: { organizacionId: true },
  });
  verificarOrganizacion(
    "Caja",
    input.cajaId,
    caja?.organizacionId,
    input.organizacionId,
  );

  if (input.cobroId) {
    const cobro = await prisma.cobro.findUnique({
      where: { id: input.cobroId },
      select: { organizacionId: true },
    });
    verificarOrganizacion(
      "Cobro",
      input.cobroId,
      cobro?.organizacionId,
      input.organizacionId,
    );
  }
}

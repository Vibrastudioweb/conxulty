/**
 * Núcleo operativo: Paciente -> Cita -> Consulta.
 *
 * Los tipos de estas entidades ya existen como modelos Prisma (ver
 * prisma/schema.prisma) y se consumen vía @prisma/client. Los casos de uso
 * de Fase 1 (flujo "Hoy") viven en los archivos de este módulo.
 */

export * from "./sesionMedica";
export * from "./pacientes";
export * from "./citas";
export * from "./consultas";

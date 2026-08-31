/**
 * "El médico no se adapta al formato de CONXULTY. CONXULTY se adapta al
 * formato del médico."
 *
 * A partir del Bloque E, `Documento` y su enum `TipoDocumento` son entidades
 * reales de Prisma (ver prisma/schema.prisma) con casos de uso reales en
 * `./documentos.ts` — ya no son conceptos de esta fase.
 *
 * Lo que queda aquí es exclusivamente lo que sigue siendo conceptual: la
 * personalización de identidad/formato por médico. El Bloque E usa un
 * formato fijo (sin plantillas), así que esto queda preparado pero sin
 * implementar — sin tablas Prisma, sin editor visual.
 */

export interface IdentidadProfesional {
  logoUrl: string | null;
  nombreMedico: string;
  especialidad: string | null;
  numeroColegiado: string | null;
  firmaUrl: string | null;
  selloUrl: string | null;
}

export interface PlantillaDocumento {
  id: string;
  medicoId: string;
  tipo: string;
  encabezado: string | null;
  piePagina: string | null;
  textosPredeterminados: Record<string, string>;
  /** Bloques habilitados y su orden; define la estructura, no el contenido. */
  estructura: string[];
}

/**
 * Puerto del motor de generación de documentos a partir de una plantilla
 * personalizada por médico. No se implementa en el Bloque E (que usa un
 * formato fijo, no plantillas) — queda preparado para cuando se construya
 * esa personalización.
 */
export interface MotorDocumentos {
  generar(input: {
    plantilla: PlantillaDocumento;
    identidad: IdentidadProfesional;
    datosConsulta: Record<string, unknown>;
  }): Promise<{ contenidoRenderizado: string }>;
}

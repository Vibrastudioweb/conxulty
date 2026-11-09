/**
 * Plantillas de Consulta por especialidad/profesión — ver changelog puntos
 * 37-40 (Bloque 3). Son campos ADICIONALES a los genéricos SOAP + signos
 * vitales que ya son HECHO en `Consulta` — un atajo de qué llenar, no una
 * guía de criterio clínico ni soporte de decisión.
 *
 * Investigación hecha antes de portar esto al real (08-nov-2026): para
 * Radiología se usaron los encabezados estándar de RSNA (Procedimiento /
 * Comparación / Hallazgos / Impresión — ver
 * https://reportingwiki.rsna.org/index.php/Proposed_Standard_Radiology_Report_Headings)
 * y para Psiquiatría la estructura de Examen Mental de uso universal en
 * psiquiatría (apariencia/conducta, habla, ánimo/afecto, pensamiento,
 * cognición, juicio). Para el resto de las 22 especialidades no existe un
 * estándar único citable de la misma forma — se revisaron varias plantillas
 * clínicas independientes (nefrología, infectología, oftalmología, etc.) y
 * se mantuvieron los campos donde hubo coincidencia entre ellas. Esto es más
 * que "criterio propio sin revisar" (como se dejó explícito en la demo,
 * punto 40), pero sigue sin ser una revisión por un especialista de cada
 * área — todos los campos son de texto libre y el médico los edita o
 * ignora sin restricción.
 */

export const ESPECIALIDADES_MEDICAS = [
  "Cardiología",
  "Cirugía bariátrica",
  "Cirugía general",
  "Cirugía plástica",
  "Dermatología",
  "Gastroenterología",
  "Ginecología y obstetricia",
  "Hematología",
  "Infectología",
  "Medicina general",
  "Medicina interna",
  "Nefrología",
  "Neurocirugía",
  "Oftalmología",
  "Otorrinolaringología",
  "Pediatría",
  "Psiquiatría",
  "Radiología",
  "Rehabilitación y medicina física",
  "Reumatología",
  "Traumatología y ortopedia",
  "Urología",
] as const;

export type EspecialidadMedica = (typeof ESPECIALIDADES_MEDICAS)[number];

export interface CampoPlantilla {
  id: string;
  label: string;
}

export const PLANTILLAS_ESPECIALIDAD: Record<EspecialidadMedica, CampoPlantilla[]> = {
  "Medicina general": [
    { id: "pa", label: "Presión arterial" },
    { id: "fc", label: "Frecuencia cardíaca" },
    { id: "temperatura", label: "Temperatura" },
    { id: "peso", label: "Peso" },
  ],
  Pediatría: [
    { id: "peso", label: "Peso" },
    { id: "talla", label: "Talla" },
    { id: "percentilCrecimiento", label: "Percentil de crecimiento" },
    { id: "esquemaVacunacion", label: "Esquema de vacunación" },
    { id: "desarrolloPsicomotor", label: "Desarrollo psicomotor" },
  ],
  "Ginecología y obstetricia": [
    { id: "fum", label: "Fecha de última menstruación (FUM)" },
    { id: "gestasPartosCesareasAbortos", label: "Gestas / Partos / Cesáreas / Abortos" },
    { id: "metodoAnticonceptivo", label: "Método anticonceptivo" },
    { id: "examenPelvico", label: "Examen pélvico" },
  ],
  Cardiología: [
    { id: "pa", label: "Presión arterial" },
    { id: "fc", label: "Frecuencia cardíaca" },
    { id: "ritmo", label: "Ritmo" },
    { id: "soplos", label: "Soplos" },
    { id: "hallazgosEcg", label: "Hallazgos de ECG" },
  ],
  Dermatología: [
    { id: "localizacion", label: "Localización" },
    { id: "tipoLesion", label: "Tipo de lesión" },
    { id: "tamano", label: "Tamaño" },
    { id: "caracteristicas", label: "Características" },
  ],
  "Traumatología y ortopedia": [
    { id: "zonaAfectada", label: "Zona afectada" },
    { id: "rangoMovimiento", label: "Rango de movimiento" },
    { id: "pruebasEspeciales", label: "Pruebas especiales" },
    { id: "estudioImagen", label: "Estudio de imagen" },
  ],
  "Cirugía bariátrica": [
    { id: "pesoImc", label: "Peso / IMC" },
    { id: "comorbilidades", label: "Comorbilidades asociadas" },
    { id: "procedimiento", label: "Procedimiento planificado/realizado" },
    { id: "evaluacionNutricional", label: "Evaluación nutricional" },
  ],
  "Cirugía general": [
    { id: "diagnosticoQuirurgico", label: "Diagnóstico quirúrgico" },
    { id: "procedimiento", label: "Procedimiento realizado" },
    { id: "hallazgosIntraoperatorios", label: "Hallazgos intraoperatorios" },
    { id: "planPostoperatorio", label: "Plan postoperatorio" },
  ],
  "Cirugía plástica": [
    { id: "procedimiento", label: "Procedimiento planificado/realizado" },
    { id: "zonaAnatomica", label: "Zona anatómica" },
    { id: "evaluacionEstetica", label: "Evaluación estética" },
    { id: "cuidadosPostoperatorios", label: "Cuidados postoperatorios" },
  ],
  Gastroenterología: [
    { id: "sintomasDigestivos", label: "Síntomas digestivos predominantes" },
    { id: "hallazgosEndoscopicos", label: "Hallazgos endoscópicos/imagenológicos" },
    { id: "habitoIntestinal", label: "Hábito intestinal" },
    { id: "planDietetico", label: "Plan dietético/tratamiento" },
  ],
  Hematología: [
    { id: "hemograma", label: "Hemograma relevante" },
    { id: "diagnosticoHematologico", label: "Diagnóstico hematológico" },
    { id: "tratamientoActual", label: "Tratamiento actual" },
    { id: "proximoControlLab", label: "Próximo control de laboratorio" },
  ],
  Infectología: [
    { id: "focoInfeccioso", label: "Foco infeccioso" },
    { id: "agente", label: "Agente aislado/sospechado" },
    { id: "esquemaAntimicrobiano", label: "Esquema antimicrobiano" },
    { id: "evolucionClinica", label: "Evolución clínica" },
  ],
  "Medicina interna": [
    { id: "comorbilidades", label: "Comorbilidades" },
    { id: "medicacionCronica", label: "Medicación crónica" },
    { id: "signosVitales", label: "Signos vitales" },
    { id: "planSeguimiento", label: "Plan de seguimiento" },
  ],
  Nefrología: [
    { id: "funcionRenal", label: "Función renal (creatinina/TFG)" },
    { id: "diagnosticoRenal", label: "Diagnóstico renal" },
    { id: "balanceHidrico", label: "Balance hídrico" },
    { id: "tratamiento", label: "Tratamiento (diálisis/medicación)" },
  ],
  Neurocirugía: [
    { id: "diagnosticoNeuroquirurgico", label: "Diagnóstico neuroquirúrgico" },
    { id: "hallazgosImagen", label: "Hallazgos de imagen (TAC/RMN)" },
    { id: "procedimiento", label: "Procedimiento planificado/realizado" },
    { id: "examenNeurologico", label: "Examen neurológico" },
  ],
  Oftalmología: [
    { id: "agudezaVisual", label: "Agudeza visual (OD/OI)" },
    { id: "presionIntraocular", label: "Presión intraocular" },
    { id: "fondoOjo", label: "Hallazgos de fondo de ojo" },
    { id: "diagnosticoOftalmologico", label: "Diagnóstico oftalmológico" },
  ],
  Otorrinolaringología: [
    { id: "examenOtoscopico", label: "Examen otoscópico" },
    { id: "examenFosasFaringe", label: "Examen de fosas nasales/faringe" },
    { id: "audiometria", label: "Audiometría (si aplica)" },
    { id: "diagnosticoOrl", label: "Diagnóstico ORL" },
  ],
  /** Estructura del Examen Mental (MSE) — dominios de uso universal en
   * psiquiatría, no propuesta de Claude. */
  Psiquiatría: [
    { id: "aparienciaConducta", label: "Apariencia y conducta" },
    { id: "habla", label: "Habla" },
    { id: "animoAfecto", label: "Estado de ánimo y afecto" },
    { id: "pensamiento", label: "Proceso y contenido del pensamiento" },
    { id: "cognicionOrientacion", label: "Cognición y orientación" },
    { id: "juicioInsight", label: "Juicio e insight" },
    { id: "diagnosticoPsiquiatrico", label: "Diagnóstico" },
    { id: "tratamientoFarmacologico", label: "Tratamiento farmacológico" },
  ],
  /** Encabezados estándar de RSNA para un reporte de imagen. */
  Radiología: [
    { id: "procedimiento", label: "Procedimiento / técnica" },
    { id: "comparacion", label: "Comparación (estudios previos)" },
    { id: "hallazgos", label: "Hallazgos" },
    { id: "impresion", label: "Impresión" },
  ],
  "Rehabilitación y medicina física": [
    { id: "diagnosticoFuncional", label: "Diagnóstico funcional" },
    { id: "planTerapia", label: "Plan de terapia" },
    { id: "evolucionFuncional", label: "Evolución funcional" },
    { id: "proximaSesion", label: "Próxima sesión" },
  ],
  Reumatología: [
    { id: "articulacionesAfectadas", label: "Articulaciones afectadas" },
    { id: "marcadoresInflamatorios", label: "Marcadores inflamatorios" },
    { id: "diagnosticoReumatologico", label: "Diagnóstico reumatológico" },
    { id: "tratamientoActual", label: "Tratamiento actual" },
  ],
  Urología: [
    { id: "sintomasUrinarios", label: "Síntomas urinarios" },
    { id: "hallazgosImagenLab", label: "Hallazgos de imagen/laboratorio" },
    { id: "diagnosticoUrologico", label: "Diagnóstico urológico" },
    { id: "planTratamiento", label: "Plan de tratamiento" },
  ],
};

/** Odontólogo y Psicólogo se resuelven por profesión, no por especialidad
 * (no hay catálogo cerrado de especialidad para ellos — ver punto 38). */
export const PLANTILLAS_PROFESION: Record<"ODONTOLOGO" | "PSICOLOGO", CampoPlantilla[]> = {
  ODONTOLOGO: [
    { id: "piezasDentales", label: "Pieza(s) dental(es)" },
    { id: "diagnosticoOdontologico", label: "Diagnóstico odontológico" },
    { id: "procedimientoRealizado", label: "Procedimiento realizado" },
    { id: "proximoControl", label: "Próximo control" },
  ],
  PSICOLOGO: [
    { id: "estadoAnimo", label: "Estado del ánimo" },
    { id: "orientacion", label: "Orientación (persona/tiempo/espacio)" },
    { id: "planTerapeutico", label: "Plan terapéutico" },
    { id: "proximaSesion", label: "Próxima sesión" },
  ],
};

export function esEspecialidadMedica(valor: string): valor is EspecialidadMedica {
  return (ESPECIALIDADES_MEDICAS as readonly string[]).includes(valor);
}

/**
 * Resuelve la plantilla a mostrar para un médico — MEDICO busca por
 * especialidad (texto libre, puede no matchear nada del catálogo si no se
 * asignó una especialidad que figura aquí); ODONTOLOGO/PSICOLOGO buscan por
 * profesión directamente; OTRA no tiene plantilla (no hay base para
 * proponer campos sin saber qué profesión es).
 */
export function resolverPlantilla(input: {
  profesion: string;
  especialidad?: string | null;
}): CampoPlantilla[] | null {
  if (input.profesion === "MEDICO") {
    if (!input.especialidad || !esEspecialidadMedica(input.especialidad)) return null;
    return PLANTILLAS_ESPECIALIDAD[input.especialidad];
  }
  if (input.profesion === "ODONTOLOGO" || input.profesion === "PSICOLOGO") {
    return PLANTILLAS_PROFESION[input.profesion];
  }
  return null;
}

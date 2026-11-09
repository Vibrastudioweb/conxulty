/**
 * Horario semanal por sede — ver changelog punto 33. Mismo patrón que el
 * repo real `vitalud` (`mi-ficha/[token]/+page.svelte`): 7 filas fijas
 * (Lunes–Domingo), cada una con `atiende` + `horaInicio`/`horaFin`.
 */
export const DIAS_SEMANA = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

export interface HorarioDia {
  dia: (typeof DIAS_SEMANA)[number];
  atiende: boolean;
  horaInicio: string | null;
  horaFin: string | null;
}

export function horarioSedeVacio(): HorarioDia[] {
  return DIAS_SEMANA.map((dia) => ({
    dia,
    atiende: false,
    horaInicio: null,
    horaFin: null,
  }));
}

/**
 * Lee el horario de UNA sede desde FormData, con campos
 * `sedeN_dia_atiende` (checkbox), `sedeN_dia_horaInicio`, `sedeN_dia_horaFin`.
 */
export function leerHorarioSedeDeFormData(
  formData: FormData,
  prefijoSede: string,
): HorarioDia[] {
  return DIAS_SEMANA.map((dia) => {
    const atiende = formData.get(`${prefijoSede}_${dia}_atiende`) === "on";
    const horaInicio = String(formData.get(`${prefijoSede}_${dia}_horaInicio`) ?? "").trim();
    const horaFin = String(formData.get(`${prefijoSede}_${dia}_horaFin`) ?? "").trim();
    return {
      dia,
      atiende,
      horaInicio: atiende && horaInicio ? horaInicio : null,
      horaFin: atiende && horaFin ? horaFin : null,
    };
  });
}

export interface ChoqueHorario {
  dia: string;
  sedeA: string;
  sedeB: string;
  horaInicioA: string;
  horaFinA: string;
  horaInicioB: string;
  horaFinB: string;
}

/**
 * Detecta choques de horario entre sedes del mismo médico — ver changelog
 * punto 33. Es una advertencia (no bloquea el registro), igual que el
 * aviso de "caja abierta de otro día" (punto 12): informar, no impedir.
 */
export function detectarChoquesHorarioSedes(
  sedes: Array<{ nombre: string; horario: HorarioDia[] }>,
): ChoqueHorario[] {
  const choques: ChoqueHorario[] = [];

  for (const dia of DIAS_SEMANA) {
    const franjas = sedes
      .map((sede) => ({ sede, franja: sede.horario.find((h) => h.dia === dia) }))
      .filter(
        (x): x is { sede: (typeof sedes)[number]; franja: HorarioDia } =>
          !!x.franja?.atiende && !!x.franja.horaInicio && !!x.franja.horaFin,
      );

    for (let i = 0; i < franjas.length; i++) {
      for (let j = i + 1; j < franjas.length; j++) {
        const a = franjas[i];
        const b = franjas[j];
        const seSolapan =
          a.franja.horaInicio! < b.franja.horaFin! && b.franja.horaInicio! < a.franja.horaFin!;
        if (seSolapan) {
          choques.push({
            dia,
            sedeA: a.sede.nombre,
            sedeB: b.sede.nombre,
            horaInicioA: a.franja.horaInicio!,
            horaFinA: a.franja.horaFin!,
            horaInicioB: b.franja.horaInicio!,
            horaFinB: b.franja.horaFin!,
          });
        }
      }
    }
  }

  return choques;
}

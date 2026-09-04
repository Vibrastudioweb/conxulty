/**
 * Parseo del campo `<input type="date">` de fecha de nacimiento, compartido
 * entre pacientes/actions.ts (crear) y pacientes/[id]/actions.ts (editar).
 *
 * A diferencia de un valor vacío (que sí significa "sin fecha de
 * nacimiento", resultado `{ fecha: null }`), un valor no vacío que no es una
 * fecha real es un dato corrupto/manipulado — nunca se descarta en
 * silencio, se reporta como inválido para que el caller rechace el envío y
 * no modifique el dato existente.
 */
export type ResultadoFechaOpcional =
  | { valida: true; fecha: Date | null }
  | { valida: false };

export function parsearFechaOpcional(valor: string | null): ResultadoFechaOpcional {
  if (!valor) {
    return { valida: true, fecha: null };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { valida: false };
  }

  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(anio, mes - 1, dia);

  // new Date(2024, 1, 30) no lanza: "rueda" a marzo. Verificar que los
  // componentes se conserven descarta fechas de calendario inexistentes
  // (30 de febrero, 31 de abril, etc.) que el regex por sí solo no detecta.
  const esFechaReal =
    !Number.isNaN(fecha.getTime()) &&
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia;

  return esFechaReal ? { valida: true, fecha } : { valida: false };
}

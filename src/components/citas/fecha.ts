/**
 * Helpers de fecha para la navegación de /agenda y /agenda/nueva (formato
 * YYYY-MM-DD en query params, sin cliente JS). Se parsea por componentes
 * (año/mes/día) en vez de `new Date(string)` para evitar el corrimiento de
 * un día que produce interpretar "YYYY-MM-DD" como medianoche UTC.
 */

export function fechaDesdeParam(param?: string): Date {
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) {
    const [anio, mes, dia] = param.split("-").map(Number);
    const fecha = new Date(anio, mes - 1, dia);
    if (!Number.isNaN(fecha.getTime())) {
      return fecha;
    }
  }
  return new Date();
}

export function formatearFechaISO(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function sumarDias(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

/** Lunes de la semana de `fecha` (semana lunes→domingo, convención es-ES). */
export function inicioSemana(fecha: Date): Date {
  const copia = new Date(fecha);
  copia.setHours(0, 0, 0, 0);
  const diaSemana = copia.getDay(); // 0=domingo .. 6=sábado
  const offset = diaSemana === 0 ? -6 : 1 - diaSemana;
  copia.setDate(copia.getDate() + offset);
  return copia;
}

/** Primer día (00:00) del mes de `fecha`. */
export function inicioMes(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
}

/**
 * Combina un campo `<input type="date">` (YYYY-MM-DD) y uno `<input
 * type="time">` (HH:mm) en un Date local, por componentes — mismo motivo que
 * fechaDesdeParam: evita el corrimiento de interpretar el string como UTC.
 * Devuelve null si cualquiera de los dos no tiene el formato esperado.
 */
export function combinarFechaHora(fecha: string, hora: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) {
    return null;
  }
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const [horaNum, minutoNum] = hora.split(":").map(Number);
  const resultado = new Date(anio, mes - 1, dia, horaNum, minutoNum, 0, 0);
  return Number.isNaN(resultado.getTime()) ? null : resultado;
}

export function formatearHoraInput(fecha: Date): string {
  const horas = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${horas}:${minutos}`;
}

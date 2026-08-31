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

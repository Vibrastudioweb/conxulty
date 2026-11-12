/**
 * Zona horaria del servidor (12-nov-2026, auditoría pre-lanzamiento).
 *
 * Todo el OS arma y muestra fechas con la hora "local" del proceso
 * (`new Date(año, mes, día, hora)`, `getHours()`, `toLocaleTimeString`),
 * y el servidor corre en hora universal. Resultado, probado en producción:
 * una cita reservada desde el Directorio a las 3:30 p.m. aparecía en la
 * agenda del médico a las 19:30, las citas cargadas en el OS quedaban
 * guardadas 4 horas corridas respecto de las del Directorio (no chocaban
 * entre sí aunque fueran a la misma hora real) y "Hoy" cambiaba de día a
 * las 8:00 p.m.
 *
 * Conxulty atiende consultorios de Venezuela, que tiene una sola zona y
 * no usa horario de verano: se fija la hora local del proceso ahí y todo
 * el código existente pasa a ser correcto sin tocarlo. La base no cambia:
 * Prisma sigue guardando en UTC (verificado ida y vuelta).
 *
 * `register` corre una sola vez al arrancar el servidor y termina antes
 * de atender el primer pedido. Si algún día hay consultorios en otro
 * país, esto deja de alcanzar y la zona pasa a ser un dato de cada
 * organización.
 */
export const ZONA_HORARIA = "America/Caracas";

export function register() {
  if (process.env.NEXT_RUNTIME && process.env.NEXT_RUNTIME !== "nodejs") return;
  process.env.TZ = ZONA_HORARIA;
  const desfaseMinutos = new Date(2026, 0, 1, 12).getTimezoneOffset();
  if (desfaseMinutos !== 240) {
    console.error(
      `[zona horaria] No se pudo fijar ${ZONA_HORARIA}: el servidor quedó con un desfase de ${desfaseMinutos} minutos. Las horas de las citas se van a ver corridas.`,
    );
  }
}

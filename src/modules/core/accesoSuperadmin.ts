/**
 * Decisión pura (sin I/O) de acceso al panel de súper-admin. Vive aparte de
 * autorizacion.ts para poder probarla sin sesión ni base de datos
 * (ver accesoSuperadmin.test.ts).
 *
 * Regla: se exige el rol SUPERADMIN tanto en la sesión (JWT) como en la
 * base de datos en el momento de la petición. Chequear solo el JWT dejaría
 * pasar a alguien degradado o desactivado hasta que expire su token.
 */

export type DecisionAccesoSuperadmin = "permitir" | "login" | "denegar";

export function decidirAccesoSuperadmin(input: {
  /** Rol que trae la sesión; undefined si no hay sesión. */
  rolSesion: string | undefined;
  /** Usuario leído de la base de datos por id de sesión; null si no existe. */
  usuarioDb: { rol: string; activo: boolean } | null;
}): DecisionAccesoSuperadmin {
  if (input.rolSesion === undefined) return "login";
  if (input.rolSesion !== "SUPERADMIN") return "denegar";
  if (!input.usuarioDb) return "denegar";
  if (!input.usuarioDb.activo) return "denegar";
  if (input.usuarioDb.rol !== "SUPERADMIN") return "denegar";
  return "permitir";
}

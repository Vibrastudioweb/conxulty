import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/db/client";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import { planDeOrganizacion, planIncluyeModulo, type ModuloPro } from "@/modules/suscripcion/plan";

/**
 * Guarda mínima compartida por toda ruta/acción autenticada, sin importar
 * el rol: exige sesión y redirige a /login si no existe. MEDICO, ADMIN y
 * STAFF parten de aquí; quien necesite además restringir por rol lo hace
 * después de llamar a esta función (ver requireMedico más abajo, o el
 * chequeo de rol en admin/page.tsx y staff/page.tsx).
 */
export async function requireSesion() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

/**
 * Punto único de guarda para rutas y acciones clínicas. Si no hay sesión,
 * redirige a /login; si la sesión existe pero el rol no es MEDICO, redirige
 * a `/`, que lo manda al destino de su rol, en vez de dejarlo avanzar hacia
 * una pantalla u operación clínica.
 */
export async function requireMedico() {
  const session = await requireSesion();

  if (session.user.rol !== "MEDICO") {
    // 13-nov-2026: antes acá se repetía el mapa de roles a destinos, igual
    // que en requireEntidad y en (dashboard)/page.tsx — tres copias de lo
    // mismo, y la rama final mandaba a /staff a cualquier rol que no fuera
    // ADMIN ni SUPERADMIN, así que una cuenta de clínica terminaba
    // rebotando por una pantalla que no es suya antes de llegar a la que
    // sí. `/` ya sabe a dónde va cada rol: que decida ahí, en un solo
    // lugar.
    redirect("/");
  }

  return session;
}

/**
 * Exige sesión de MEDICO (ver requireMedico) y resuelve su perfil Medico.
 * Las páginas/acciones clínicas parten de aquí para obtener el medicoId
 * autenticado con el que luego deben verificar que la Consulta les
 * pertenece — cada médico solo puede acceder, modificar y cerrar sus
 * propias consultas, nunca las de otro médico de la misma organización.
 */
export async function requireMedicoSesion() {
  const session = await requireMedico();
  const medico = await resolverMedicoAutenticado({
    organizacionId: session.user.organizacionId,
    usuarioId: session.user.id,
  });
  return { session, medico };
}

/**
 * Punto único de guarda para rutas y acciones de clínica/farmacia — ver
 * changelog punto 90/92. Igual que `requireMedico`: si no hay sesión,
 * redirige a /login; si la sesión existe pero el rol no es ENTIDAD,
 * redirige a donde le corresponde en vez de dejarlo avanzar.
 */
export async function requireEntidad() {
  const session = await requireSesion();

  if (session.user.rol !== "ENTIDAD") {
    redirect("/");
  }

  return session;
}

/**
 * Exige sesión de ENTIDAD (ver requireEntidad) y resuelve su perfil
 * Entidad. La pantalla de "Mi ficha pública" de clínica/farmacia parte de
 * acá, igual que requireMedicoSesion resuelve `Medico` para la suya.
 */
export async function requireEntidadSesion() {
  const session = await requireEntidad();
  const entidad = await prisma.entidad.findUniqueOrThrow({
    where: { usuarioId: session.user.id },
  });
  return { session, entidad };
}

/**
 * Guarda de todo lo que cuelga de /superadmin (páginas Y server actions —
 * estas últimas son endpoints públicos y deben validar por sí mismas).
 * Además del rol del JWT, confirma contra la base que el usuario sigue
 * activo y siendo SUPERADMIN: el token vive hasta que expira y no
 * reflejaría una degradación o desactivación hecha después del login.
 * Cualquier otro rol (incluido ADMIN de una organización) vuelve a "/".
 */
export async function requireSuperadmin() {
  const session = await requireSesion();

  if (session.user.rol !== "SUPERADMIN") {
    redirect("/");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: { rol: true, activo: true },
  });
  if (!usuario || !usuario.activo || usuario.rol !== "SUPERADMIN") {
    redirect("/");
  }

  return session;
}

/**
 * Guarda de los módulos que solo trae el plan Pro (13-nov-2026, hallazgo
 * C2 de la auditoría: el plan no se consultaba en ninguna parte y Ficha
 * veía lo mismo que Pro).
 *
 * Va en las SERVER ACTIONS, que son endpoints públicos: esconder un botón
 * no impide que alguien mande el formulario igual. Las páginas no usan
 * esto — en vez de rebotar al médico, muestran la pantalla de "esto es
 * de Pro" con el precio y el enlace de pago (ver PanelSoloPro).
 *
 * El plan vive en la Organizacion, no en el usuario: aplica igual a
 * MEDICO, ADMIN y STAFF del mismo consultorio.
 */
export async function requirePro(modulo: ModuloPro) {
  const session = await requireSesion();
  const plan = await planDeOrganizacion(session.user.organizacionId);
  if (!planIncluyeModulo(plan, modulo)) {
    redirect(`/ajustes?pro=${modulo}`);
  }
  return session;
}

/** El plan de quien está en sesión, para que una página decida si muestra
 *  su contenido o la pantalla de Pro. */
export async function planDeSesion() {
  const session = await requireSesion();
  return { session, plan: await planDeOrganizacion(session.user.organizacionId) };
}

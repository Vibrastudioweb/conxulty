import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/db/client";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";

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
 * al destino que le corresponde (/admin o /staff) en vez de dejarlo avanzar
 * hacia una pantalla u operación clínica.
 */
export async function requireMedico() {
  const session = await requireSesion();

  if (session.user.rol !== "MEDICO") {
    redirect(
      session.user.rol === "ADMIN"
        ? "/admin"
        : session.user.rol === "SUPERADMIN"
          ? "/superadmin"
          : "/staff",
    );
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

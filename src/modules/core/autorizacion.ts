import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/db/client";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";
import { decidirAccesoSuperadmin } from "@/modules/core/accesoSuperadmin";

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
    redirect(destinoPorRol(session.user.rol));
  }

  return session;
}

/** Pantalla de inicio que le corresponde a cada rol no clínico. */
export function destinoPorRol(rol: string): string {
  if (rol === "ADMIN") return "/admin";
  if (rol === "SUPERADMIN") return "/superadmin";
  return "/staff";
}

/**
 * Guarda del panel de súper-admin. Exige sesión y rol SUPERADMIN tanto en el
 * JWT como en la base de datos (ver decidirAccesoSuperadmin). Quien no cumple
 * vuelve a "/" (que lo envía a la pantalla de su propio rol), no ve nada del
 * panel. Debe llamarse al inicio de CADA página y server action de /superadmin:
 * el layout no basta, las acciones se invocan directamente.
 */
export async function requireSuperadmin() {
  const session = await auth();
  const usuarioDb = session?.user
    ? await prisma.usuario.findUnique({
        where: { id: session.user.id },
        select: { rol: true, activo: true },
      })
    : null;

  const decision = decidirAccesoSuperadmin({
    rolSesion: session?.user?.rol,
    usuarioDb,
  });

  if (decision === "login") redirect("/login");
  if (decision === "denegar") redirect("/");

  return session!;
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

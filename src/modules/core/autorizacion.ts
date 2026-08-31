import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolverMedicoAutenticado } from "@/modules/core/sesionMedica";

/**
 * Punto único de guarda para rutas y acciones clínicas. Si no hay sesión,
 * redirige a /login; si la sesión existe pero el rol no es MEDICO, redirige
 * al destino que le corresponde (/admin o /staff) en vez de dejarlo avanzar
 * hacia una pantalla u operación clínica.
 */
export async function requireMedico() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.rol !== "MEDICO") {
    redirect(session.user.rol === "ADMIN" ? "/admin" : "/staff");
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

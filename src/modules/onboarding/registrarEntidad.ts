import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/db/client";
import { EmailYaRegistradoError } from "@/modules/acceso/solicitudes";
import { type TipoEntidadId } from "@/modules/onboarding/tiposEntidad";
import { horarioSedeVacio, type HorarioDia } from "@/modules/onboarding/horarioSede";

export interface RegistrarEntidadInput {
  nombre: string;
  email: string;
  /** Texto plano — se hashea acá, nunca se persiste en claro. */
  password: string;
  tipo: TipoEntidadId;
  municipio?: string | null;
  direccion?: string | null;
  telefono?: string | null;
  horario: HorarioDia[];
}

/**
 * Registro self-service de una clínica o farmacia — ver changelog punto
 * 90/92. Mismo patrón que `registrarMedico` (Organizacion + Usuario en una
 * transacción), pero crea `Entidad` en vez de `Medico` y SIN Sede/citas:
 * esa es la diferencia de producto, no un recorte temporal. Gratis por
 * ahora (sin Suscripcion/Pago) — decisión explícita del usuario, 09-nov-2026.
 */
export async function registrarEntidad(
  input: RegistrarEntidadInput,
): Promise<{ usuarioId: string; organizacionId: string }> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    return await prisma.$transaction(async (tx) => {
      const organizacion = await tx.organizacion.create({
        data: { nombre: input.nombre, plan: "FICHA" },
        select: { id: true },
      });

      const usuario = await tx.usuario.create({
        data: {
          organizacionId: organizacion.id,
          nombre: input.nombre,
          email: input.email,
          passwordHash,
          rol: "ENTIDAD",
        },
        select: { id: true },
      });

      await tx.entidad.create({
        data: {
          usuarioId: usuario.id,
          organizacionId: organizacion.id,
          tipo: input.tipo,
          municipio: input.municipio?.trim() || null,
          direccion: input.direccion?.trim() || null,
          telefono: input.telefono?.trim() || null,
          horario: (input.horario.length > 0 ? input.horario : horarioSedeVacio()) as unknown as Prisma.InputJsonValue,
        },
      });

      return { usuarioId: usuario.id, organizacionId: organizacion.id };
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new EmailYaRegistradoError();
    }
    throw err;
  }
}

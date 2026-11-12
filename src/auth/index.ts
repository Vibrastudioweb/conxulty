import crypto from "node:crypto";
import { cache } from "react";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/db/client";
import {
  accesoBloqueado,
  limpiarFallosAcceso,
  registrarFalloAcceso,
} from "@/modules/acceso/intentos";

// 12-nov-2026 (auditoría, M4): el correo se pasa a minúsculas igual que en
// /registro — antes "Juan@Gmail.com" se registraba como "juan@gmail.com"
// y después no podía entrar escribiéndolo con mayúsculas.
const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1),
});

// Hash dummy con el mismo costo (10 rounds) que los hashes reales. Se compara
// contra él cuando el usuario no existe o está inactivo, para que el tiempo
// de respuesta no revele si un correo existe en el sistema (timing side-channel).
const HASH_DUMMY = bcrypt.hashSync(
  "conxulty-comparacion-de-costo-constante",
  10,
);

/**
 * Huella de la contraseña vigente — viaja en el JWT para poder detectar
 * que cambió (12-nov-2026, auditoría, M1). Antes una sesión abierta seguía
 * viva hasta 30 días aunque se restableciera la contraseña o se desactivara
 * al usuario. No es reversible ni sirve para iniciar sesión: es un hash
 * truncado de un hash de bcrypt.
 */
function huellaDe(passwordHash: string): string {
  return crypto.createHash("sha256").update(passwordHash).digest("hex").slice(0, 16);
}

/** Una sola consulta por request aunque `auth()` se llame varias veces
 *  (layout + página + guardas): `cache` de React deduplica dentro del
 *  mismo render de servidor. Fuera de un render (route handlers) no
 *  deduplica, solo consulta — mismo resultado. */
const leerEstadoUsuario = cache(async (usuarioId: string) =>
  prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { activo: true, passwordHash: true, rol: true, organizacionId: true },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      authorize: async (rawCredentials) => {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;

        // Freno de fuerza bruta (A3) — se evalúa acá y no solo en la
        // pantalla de login porque este proveedor también es alcanzable
        // directo por /api/auth/callback/credentials.
        if (await accesoBloqueado(parsed.data.email)) return null;

        const usuario = await prisma.usuario.findUnique({
          where: { email: parsed.data.email },
        });

        // Se compara siempre, exista o no el usuario, para que ambos caminos
        // tengan un costo similar (ver HASH_DUMMY arriba).
        const passwordValida = await bcrypt.compare(
          parsed.data.password,
          usuario?.passwordHash ?? HASH_DUMMY,
        );

        if (!usuario || !usuario.activo || !passwordValida) {
          // Se registra exista o no la cuenta: contar solo las que existen
          // revelaría qué correos están registrados.
          await registrarFalloAcceso(parsed.data.email);
          return null;
        }

        await limpiarFallosAcceso(parsed.data.email);

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          organizacionId: usuario.organizacionId,
          rol: usuario.rol,
          huella: huellaDe(usuario.passwordHash),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.organizacionId = user.organizacionId;
        token.rol = user.rol;
        token.huella = user.huella;
        return token;
      }

      // Revalidación contra la base en cada lectura de sesión (M1): el JWT
      // por sí solo no se entera de que el usuario fue desactivado o cambió
      // su contraseña. Devolver null cierra la sesión (Auth.js borra la
      // cookie donde puede; donde no puede, `auth()` igual devuelve null).
      if (!token.sub) return null;
      let usuario: Awaited<ReturnType<typeof leerEstadoUsuario>>;
      try {
        usuario = await leerEstadoUsuario(token.sub);
      } catch (err) {
        // Si la base no responde, la sesión se deja como está en vez de
        // cerrarla: un error acá haría que Auth.js borre la cookie, y un
        // corte de un segundo con la base sacaría a todos los que estén
        // trabajando. Sin base nada más funciona igual, así que no se abre
        // ninguna puerta.
        console.error("[auth] No se pudo revalidar la sesión (se conserva):", err);
        return token;
      }
      if (!usuario || !usuario.activo) return null;

      const huellaActual = huellaDe(usuario.passwordHash);
      // Sesiones abiertas antes de este cambio no traen huella: se adoptan
      // (no se obliga a todos a volver a entrar), y desde ahí quedan atadas
      // a la contraseña vigente.
      if (token.huella && token.huella !== huellaActual) return null;

      token.huella = huellaActual;
      token.rol = usuario.rol;
      token.organizacionId = usuario.organizacionId;
      return token;
    },
    session({ session, token }) {
      session.user.id = token.sub!;
      session.user.organizacionId = token.organizacionId;
      session.user.rol = token.rol;
      return session;
    },
  },
});

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/db/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Hash dummy con el mismo costo (10 rounds) que los hashes reales. Se compara
// contra él cuando el usuario no existe o está inactivo, para que el tiempo
// de respuesta no revele si un correo existe en el sistema (timing side-channel).
const HASH_DUMMY = bcrypt.hashSync(
  "conxulty-comparacion-de-costo-constante",
  10,
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

        const usuario = await prisma.usuario.findUnique({
          where: { email: parsed.data.email },
        });

        // Se compara siempre, exista o no el usuario, para que ambos caminos
        // tengan un costo similar (ver HASH_DUMMY arriba).
        const passwordValida = await bcrypt.compare(
          parsed.data.password,
          usuario?.passwordHash ?? HASH_DUMMY,
        );

        if (!usuario || !usuario.activo || !passwordValida) return null;

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nombre,
          organizacionId: usuario.organizacionId,
          rol: usuario.rol,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.organizacionId = user.organizacionId;
        token.rol = user.rol;
      }
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

import type { RolUsuario } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    organizacionId: string;
    rol: RolUsuario;
  }

  interface Session {
    user: {
      id: string;
      organizacionId: string;
      rol: RolUsuario;
    } & DefaultSession["user"];
  }
}

// La firma de los callbacks (jwt/session) de Auth.js v5 resuelve el tipo JWT
// desde "@auth/core/jwt", no desde "next-auth/jwt" (que solo lo re-exporta),
// así que la augmentación debe apuntar al módulo real.
declare module "@auth/core/jwt" {
  interface JWT {
    organizacionId: string;
    rol: RolUsuario;
  }
}

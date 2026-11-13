import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/db/client";
import {
  limpiarFallosAcceso,
  recuperacionBloqueada,
  registrarPedidoRecuperacion,
} from "@/modules/acceso/intentos";
import { enviarCorreo, urlBase } from "@/modules/correo/enviar";

/**
 * "Olvidé mi contraseña" (10-nov-2026, pedido del usuario: "falta olvide
 * usuario y olvide contraseña"). El login es por correo — no hay un
 * "usuario" separado de eso, así que no hay nada que recuperar ahí (ver
 * `Usuario.email @unique` en schema.prisma); esto cubre solo contraseña.
 *
 * Mismo cuidado que `auth/index.ts` con no revelar si un correo existe:
 * `solicitarRecuperacion` nunca lanza ni devuelve si encontró al usuario —
 * la Server Action siempre muestra el mismo mensaje exista o no la cuenta.
 */

const VIGENCIA_MS = 60 * 60 * 1000; // 1 hora — vida corta, de un solo uso.

/**
 * Lo que se guarda en la base es el SHA-256 del token, nunca el token
 * (12-nov-2026, auditoría, hallazgo C1): el valor real solo existe en el
 * link del correo. Si alguien llega a leer `tokens_recuperacion`, lo que
 * encuentra no sirve para armar un link válido. SHA-256 sin sal alcanza
 * porque el token son 32 bytes al azar — no hay nada que adivinar.
 */
function hashDeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}


/**
 * Crea un token nuevo y manda el correo con el link — best-effort en el
 * envío (igual que `notificarSolicitudAcceso`), pero el token SÍ queda
 * guardado aunque el correo falle, para no inventarle al usuario un link
 * que nunca llegó si después revisa la base.
 */
export async function solicitarRecuperacion(emailCrudo: string): Promise<void> {
  const email = emailCrudo.trim().toLowerCase();
  if (!email) return;

  // Tope de pedidos por correo (auditoría, A3): sin esto se podía llenar
  // de correos la bandeja de cualquiera. Se cuenta ANTES de saber si la
  // cuenta existe, para que el tope tampoco revele qué correos hay.
  if (await recuperacionBloqueada(email)) return;
  await registrarPedidoRecuperacion(email);

  const usuario = await prisma.usuario.findUnique({ where: { email } });
  if (!usuario || !usuario.activo) return; // Mismo correo genérico para todos los casos — ver la Server Action.

  // Reemplazo completo: un pedido nuevo invalida cualquier link viejo sin
  // usar de este mismo usuario (mismo criterio de "reemplazo completo" que
  // ya usa este proyecto para sedes/especialidades del lado del Directorio).
  await prisma.tokenRecuperacion.deleteMany({ where: { usuarioId: usuario.id, usado: false } });

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.tokenRecuperacion.create({
    data: {
      usuarioId: usuario.id,
      token: hashDeToken(token),
      expiraEn: new Date(Date.now() + VIGENCIA_MS),
    },
  });

  await enviarCorreoRecuperacion(email, token);
}

async function enviarCorreoRecuperacion(email: string, token: string): Promise<void> {
  const link = `${urlBase()}/restablecer?token=${token}`;
  await enviarCorreo({
    origen: "recuperacion",
    para: email,
    asunto: "Restablece tu contraseña — Conxulty",
    texto: [
      "Pediste restablecer tu contraseña en Conxulty.",
      "",
      `Entra acá para elegir una nueva (el link vence en 1 hora): ${link}`,
      "",
      "Si no fuiste tú, ignora este correo — tu contraseña actual sigue funcionando.",
    ].join("\n"),
  });
}

/** Solo valida (no consume) — para decidir si /restablecer muestra el
 *  formulario o un aviso de "link vencido". */
export async function tokenRecuperacionValido(token: string): Promise<boolean> {
  if (!token) return false;
  const fila = await prisma.tokenRecuperacion.findUnique({ where: { token: hashDeToken(token) } });
  return !!fila && !fila.usado && fila.expiraEn > new Date();
}

export class TokenRecuperacionInvalidoError extends Error {
  constructor() {
    super("Este link ya venció o ya se usó — pide uno nuevo.");
    this.name = "TokenRecuperacionInvalidoError";
  }
}

/** Valida y CONSUME el token en la misma transacción que cambia la
 *  contraseña — un token no puede usarse dos veces ni sobrevivir a un
 *  restablecimiento exitoso. */
export async function restablecerContrasena(token: string, nuevaContrasena: string): Promise<void> {
  const passwordHash = await bcrypt.hash(nuevaContrasena, 10);

  const email = await prisma.$transaction(async (tx) => {
    const fila = await tx.tokenRecuperacion.findUnique({ where: { token: hashDeToken(token) } });
    if (!fila || fila.usado || fila.expiraEn <= new Date()) {
      throw new TokenRecuperacionInvalidoError();
    }
    const usuario = await tx.usuario.update({
      where: { id: fila.usuarioId },
      data: { passwordHash },
      select: { email: true },
    });
    await tx.tokenRecuperacion.update({ where: { id: fila.id }, data: { usado: true } });
    return usuario.email;
  });

  // Quien quedó bloqueado por contraseñas fallidas y restablece la suya
  // por correo ya demostró que la cuenta es suya: entra de una vez, sin
  // esperar a que venza el bloqueo. Las sesiones que estuvieran abiertas
  // con la contraseña vieja se cierran solas (huella en auth/index.ts).
  await limpiarFallosAcceso(email);
}

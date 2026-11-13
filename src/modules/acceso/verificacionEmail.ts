import crypto from "node:crypto";
import { prisma } from "@/db/client";
import { enviarCorreo, urlBase } from "@/modules/correo/enviar";

/**
 * Confirmación del correo al registrarse (13-nov-2026).
 *
 * QUÉ RIESGO CIERRA, y cuál no. No es el spam: hoy las altas se hacen
 * hablando con cada médico. Es el caso aburrido y silencioso — quien se
 * registra con el correo mal escrito entra igual, usa el producto, y el
 * día que olvida su contraseña descubre que no puede recuperarla. Pierde
 * su cuenta y su ficha pública, y nadie se entera hasta que llama.
 *
 * POR QUÉ NO BLOQUEA LA ENTRADA. Trancar el OS hasta que confirme suena
 * más seguro y es peor: un médico en Valera con la conexión floja y el
 * correo en spam se queda afuera en el primer minuto, que es justo cuando
 * decide si esto le sirve. Entra, ve un aviso, y lo único que no puede
 * hacer sin confirmar es PUBLICAR su ficha en el Directorio — el paso que
 * lo expone a pacientes, y donde un correo al que no llegamos sí importa.
 */

const VIGENCIA_HORAS = 48;
/** Tope de reenvíos por hora, para que el botón no sirva de ariete. */
const MAXIMO_REENVIOS_POR_HORA = 3;

/** Igual que en recuperacion.ts: en la base vive el hash, nunca el token. */
function hashDeToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function usuarioVerificado(usuarioId: string): Promise<boolean> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { emailVerificado: true },
  });
  return usuario?.emailVerificado != null;
}

/**
 * Crea el token y manda el correo. Best-effort a propósito: la cuenta ya
 * está creada cuando se llama acá, y un proveedor de correo lento no puede
 * tumbar un registro. Si no sale, el médico tiene el botón de reenviar.
 */
export async function enviarVerificacion(usuarioId: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { email: true, nombre: true, emailVerificado: true },
  });
  if (!usuario || usuario.emailVerificado) return;

  const token = crypto.randomBytes(32).toString("hex");
  await prisma.tokenVerificacion.create({
    data: {
      usuarioId,
      token: hashDeToken(token),
      expiraEn: new Date(Date.now() + VIGENCIA_HORAS * 60 * 60 * 1000),
    },
  });

  await enviarCorreo({
    origen: "verificacion",
    para: usuario.email,
    asunto: "Confirma tu correo — Conxulty",
    texto: [
      `Hola ${usuario.nombre},`,
      "",
      "Confirma que este correo es tuyo para poder publicar tu ficha en el directorio",
      "y para poder recuperar tu contraseña si alguna vez la olvidas:",
      "",
      `${urlBase()}/verificar?token=${token}`,
      "",
      `El enlace vence en ${VIGENCIA_HORAS} horas.`,
      "",
      "Si no te registraste en Conxulty, ignora este correo.",
    ].join("\n"),
  });
}

export type ResultadoVerificacion = "verificado" | "ya-estaba" | "invalido" | "vencido";

/**
 * Consume el token. Marca el usuario como verificado y quema el token, de
 * forma que un enlace reenviado por error no sirva dos veces.
 */
export async function verificarConToken(token: string): Promise<ResultadoVerificacion> {
  if (!token) return "invalido";

  const registro = await prisma.tokenVerificacion.findUnique({
    where: { token: hashDeToken(token) },
    select: { id: true, usado: true, expiraEn: true, usuarioId: true },
  });
  if (!registro) return "invalido";

  const usuario = await prisma.usuario.findUnique({
    where: { id: registro.usuarioId },
    select: { emailVerificado: true },
  });
  if (usuario?.emailVerificado) return "ya-estaba";

  if (registro.usado) return "invalido";
  if (registro.expiraEn.getTime() < Date.now()) return "vencido";

  await prisma.$transaction([
    prisma.tokenVerificacion.update({ where: { id: registro.id }, data: { usado: true } }),
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { emailVerificado: new Date() },
    }),
    // Los demás tokens vivos del mismo usuario dejan de servir: ya cumplió.
    prisma.tokenVerificacion.updateMany({
      where: { usuarioId: registro.usuarioId, usado: false },
      data: { usado: true },
    }),
  ]);

  return "verificado";
}

export type ResultadoReenvio = "enviado" | "ya-verificado" | "demasiados-intentos";

/** Reenvía el correo, con tope por hora. */
export async function reenviarVerificacion(usuarioId: string): Promise<ResultadoReenvio> {
  if (await usuarioVerificado(usuarioId)) return "ya-verificado";

  const desde = new Date(Date.now() - 60 * 60 * 1000);
  const recientes = await prisma.tokenVerificacion.count({
    where: { usuarioId, createdAt: { gte: desde } },
  });
  if (recientes >= MAXIMO_REENVIOS_POR_HORA) return "demasiados-intentos";

  await enviarVerificacion(usuarioId);
  return "enviado";
}

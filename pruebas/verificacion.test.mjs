/**
 * Confirmación del correo al registrarse.
 *
 * POR QUÉ ESTE FLUJO: lo que cierra no es el spam —hoy las altas se hacen
 * hablando con cada médico— sino el caso silencioso: quien se registra con
 * el correo mal escrito entra igual, usa el producto, y el día que olvida
 * su contraseña descubre que no puede recuperarla. Pierde su cuenta y su
 * ficha pública, y nadie se entera hasta que llama.
 *
 * Lo más delicado NO es que la confirmación funcione: es que una médica
 * que ya estaba adentro NO quede trancada por un requisito que nació
 * después que ella. Eso se comprueba primero, antes que nada.
 *
 * Se prueba contra la página real (/verificar), no contra el módulo: el
 * token se guarda hasheado, así que la prueba siembra el hash de un token
 * que ella misma genera y después abre el enlace como lo abriría el
 * médico desde su correo.
 *
 *   node pruebas/verificacion.test.mjs
 */

import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BASE_URL,
  comprobar,
  correr,
  ejecutar,
  esperarTexto,
  exigirAppViva,
  navegadorConSesion,
  valor,
} from "./entorno.mjs";
import { EMAIL_MEDICO, ORG, USUARIO, limpiar, sembrar } from "./sembrar.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const hash = (t) => crypto.createHash("sha256").update(t).digest("hex");
const confirmado = async () =>
  (await valor(`select "emailVerificado" is not null from usuarios where id = '${USUARIO}'`)) === true;

/** Siembra un token como lo haría el envío real, y devuelve el que iría en el enlace. */
async function sembrarToken({ horasDeVida = 48, usado = false } = {}) {
  const enClaro = crypto.randomBytes(32).toString("hex");
  await ejecutar(`
    insert into tokens_verificacion (id, "usuarioId", token, "expiraEn", usado, "createdAt")
    values ('tok-${crypto.randomUUID()}', '${USUARIO}', '${hash(enClaro)}',
            now() + interval '${horasDeVida} hours', ${usado}, now())`);
  return enClaro;
}

/** Abre el enlace del correo y devuelve lo que vería el médico. */
async function abrirEnlace(token) {
  const r = await fetch(`${BASE_URL}/verificar?token=${token}`);
  const html = await r.text();
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

await correr("Confirmación del correo", async () => {
  await exigirAppViva();
  await sembrar();

  // ── 1. Lo primero: nadie que ya estaba adentro queda trancado ─────
  //
  // Si esto falla, la única médica real del Directorio no puede volver a
  // tocar su ficha por un requisito que nació después que ella.
  //
  // Se corre el UPDATE de relleno leyéndolo DEL ARCHIVO de migración, no
  // copiado acá: si alguien lo cambia o lo borra, esta prueba se entera.
  const migracion = readFileSync(
    join(RAIZ, "prisma/migrations/20261113180000_verificacion_email/migration.sql"),
    "utf8",
  );
  const sinComentarios = (sql) =>
    sql
      .split("\n")
      .filter((l) => !l.trim().startsWith("--"))
      .join("\n")
      .trim();
  const relleno = migracion
    .split(";")
    .map(sinComentarios)
    .find((c) => /^UPDATE "usuarios"/i.test(c));
  comprobar("La migración trae el relleno para las cuentas que ya existían", Boolean(relleno), "no se encontró el UPDATE");

  if (relleno) {
    // Las dos cuentas sembradas hacen de "cuentas de antes": nacen sin
    // confirmar, como estaban todas antes de esta migración.
    await ejecutar(`update usuarios set "emailVerificado" = null`);
    await ejecutar(relleno);
    comprobar(
      "Tras la migración, ninguna cuenta anterior queda sin confirmar",
      Number(await valor(`select count(*) from usuarios where "emailVerificado" is null`)) === 0,
      `${await valor(`select count(*) from usuarios where "emailVerificado" is null`)} sin confirmar`,
    );
  }

  // A partir de acá se simula una cuenta recién registrada.
  await ejecutar(`update usuarios set "emailVerificado" = null where id = '${USUARIO}'`);

  // ── 2. Un enlace inventado no confirma a nadie ────────────────────
  let visto = await abrirEnlace("a".repeat(64));
  comprobar("Un enlace inventado no sirve", visto.includes("no sirve"), visto.slice(0, 120));
  comprobar("Y no confirma la cuenta", !(await confirmado()));

  // ── 3. Un enlace vencido tampoco ──────────────────────────────────
  const vencido = await sembrarToken({ horasDeVida: -1 });
  visto = await abrirEnlace(vencido);
  comprobar("Un enlace vencido avisa que venció", visto.includes("venció"), visto.slice(0, 120));
  comprobar("Y tampoco confirma la cuenta", !(await confirmado()));

  // ── 4. El enlace bueno confirma, y solo una vez ───────────────────
  const bueno = await sembrarToken();
  visto = await abrirEnlace(bueno);
  comprobar("El enlace bueno confirma el correo", visto.includes("quedó confirmado"), visto.slice(0, 150));
  comprobar("Y queda registrado en la cuenta", await confirmado());

  visto = await abrirEnlace(bueno);
  comprobar(
    "El mismo enlace reenviado no vuelve a hacer nada raro",
    visto.includes("ya estaba confirmado"),
    visto.slice(0, 150),
  );

  // ── 5. Confirmar quema los demás enlaces vivos del mismo médico ───
  // Si pidió el reenvío tres veces, los tres enlaces llegaron a su correo.
  // Una vez confirmado, ninguno debería seguir sirviendo.
  await ejecutar(`update usuarios set "emailVerificado" = null where id = '${USUARIO}'`);
  await ejecutar(`delete from tokens_verificacion where "usuarioId" = '${USUARIO}'`);
  const primero = await sembrarToken();
  const segundo = await sembrarToken();
  await abrirEnlace(primero);
  comprobar(
    "Tras confirmar, los otros enlaces que mandamos dejan de servir",
    Number(
      await valor(`select count(*) from tokens_verificacion where "usuarioId" = '${USUARIO}' and usado = false`),
    ) === 0,
    await valor(`select count(*) from tokens_verificacion where "usuarioId" = '${USUARIO}' and usado = false`),
  );
  comprobar("Y el segundo enlace ya no confirma nada por su cuenta", (await abrirEnlace(segundo)).includes("ya estaba"));

  // ── 6. El aviso dentro del OS ─────────────────────────────────────
  const { navegador, pagina } = await navegadorConSesion({
    email: EMAIL_MEDICO,
    usuarioId: USUARIO,
    organizacionId: ORG,
    rol: "MEDICO",
    nombre: "Dra. de Prueba",
  });

  await ejecutar(`update usuarios set "emailVerificado" = null where id = '${USUARIO}'`);
  await pagina.goto(`${BASE_URL}/hoy`);
  await esperarTexto(pagina, "confirmar");
  let cuerpo = (await pagina.locator("body").innerText()).replace(/\s+/g, " ").trim();
  comprobar(
    "Sin confirmar, el OS lo avisa y ofrece reenviar",
    cuerpo.includes("confirmar que es tuyo") && cuerpo.includes("Reenviar"),
    cuerpo.slice(0, 250),
  );
  comprobar(
    "Y le dice qué pierde si no lo hace, en vez de sonar a trámite",
    cuerpo.includes("recuperar tu contraseña"),
    cuerpo.slice(0, 250),
  );

  await ejecutar(`update usuarios set "emailVerificado" = now() where id = '${USUARIO}'`);
  await pagina.goto(`${BASE_URL}/hoy`);
  cuerpo = (await pagina.locator("body").innerText()).replace(/\s+/g, " ").trim();
  comprobar("Una vez confirmado, el aviso desaparece", !cuerpo.includes("confirmar que es tuyo"), cuerpo.slice(0, 200));

  await navegador.close();
  await limpiar();
});

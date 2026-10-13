import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/l/I) para que se pueda dictar por WhatsApp.
const MAYUS = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const MINUS = "abcdefghijkmnopqrstuvwxyz";
const DIGITOS = "23456789";
const SIMBOLOS = "!@#$%&*?";
const TODOS = MAYUS + MINUS + DIGITOS + SIMBOLOS;

function elegir(alfabeto: string): string {
  return alfabeto[randomInt(alfabeto.length)];
}

/**
 * Contraseña temporal aleatoria con CSPRNG (crypto.randomInt), 14 caracteres,
 * garantizando al menos una mayúscula, minúscula, dígito y símbolo.
 */
export function generarPasswordTemporal(longitud = 14): string {
  const chars = [
    elegir(MAYUS),
    elegir(MINUS),
    elegir(DIGITOS),
    elegir(SIMBOLOS),
  ];
  while (chars.length < longitud) chars.push(elegir(TODOS));

  // Fisher–Yates con randomInt para no dejar las 4 clases en posiciones fijas.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

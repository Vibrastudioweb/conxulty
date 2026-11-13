# Pruebas

Programas que usan el producto como lo usaría un médico y comprueban que
pasó lo que tenía que pasar. Se corren con un comando y en un minuto dicen
qué se rompió.

## Qué se prueba, y por qué solo esto

No se prueba todo. Se prueba **lo que se rompe en silencio y sale caro**:
lo que falla sin que nadie se entere hasta que un cliente reclama.

| Archivo | Flujo | Por qué está acá |
|---|---|---|
| `reserva.test.mjs` | Un paciente reserva desde el Directorio | El único flujo donde la falla la ve un paciente y no el consultorio. Ya se rompió dos veces: una, el endpoint llevaba días devolviendo 503 en producción por una variable de entorno que faltaba; otra, las citas se guardaban con cuatro horas de corrimiento porque el servidor pensaba en UTC y Venezuela está en UTC-4. |
| `dinero.test.mjs` | Reportar un pago → confirmarlo → plan activo → fecha al Directorio | Es el flujo que decide si el negocio cobra, y es manual de punta a punta: no hay pasarela que avise si un eslabón se desconecta. El último paso es el que apaga el contacto de una ficha impaga; si se corta, cualquiera usa el producto gratis para siempre. |
| `agenda.test.mjs` | Cancelar una cita y deshacerlo | Cancelar es un clic sin confirmación, al lado de "Confirmar". Lo delicado no es devolver la cita: es **no** devolverla cuando ya le dieron ese hueco a otro paciente. Si eso falla, quedan dos personas citadas a la misma hora. |

Lo que **no** se prueba, a propósito: que el botón sea azul, que el texto
diga tal cosa, cómo se ve en el móvil. Eso cambia diez veces antes de
estabilizarse y una prueba así solo da trabajo.

Aparte de estas, `npm run db:comparar` comprueba que la base tenga todo lo
que describe `schema.prisma` — eso vive en `scripts/`, no acá, porque no
necesita que la app esté corriendo.

## Cómo correrlas

Hace falta una base **local** (nunca producción: ver más abajo) y la app
compilada y levantada contra esa base.

```bash
# 1. Una base de pruebas, vacía, con todas las migraciones
createdb conxulty_pruebas
for d in prisma/migrations/*/; do psql -d conxulty_pruebas -f "$d/migration.sql"; done

# 2. Las variables, las mismas para la app y para las pruebas
export DATABASE_URL="postgresql://localhost:5432/conxulty_pruebas"
export AUTH_SECRET="cualquier-cosa-larga-solo-para-local"
export AUTH_TRUST_HOST=true
export CONXULTY_SYNC_SECRET="cualquier-cosa-solo-para-local"

# 3. La app
npm run build && npx next start -p 3111

# 4. Las pruebas, en otra terminal con las mismas variables
npm run pruebas
```

Para correr una sola: `node pruebas/reserva.test.mjs`.

`dinero` y `agenda` manejan un navegador; la primera vez hace falta
instalarlo:

```bash
npm install --no-save playwright && npx playwright install chromium
```

`reserva` no lo necesita: es servidor contra servidor, igual que en
producción.

Playwright **no está en `package.json`** a propósito: instalarlo arrastra la
descarga de un navegador entero, y eso no tiene por qué pasar en cada
despliegue de producción.

## Nunca contra producción

Estas pruebas crean, modifican y **borran** filas: pagos, citas, pacientes.
Contra la base real serían un desastre silencioso.

Por eso `exigirBaseLocal()` corta la corrida si `DATABASE_URL` no apunta a
`localhost` o `127.0.0.1`. **No hay bandera para saltárselo.** Si algún día
hiciera falta correrlas contra otra base, hay que editar esa función a mano
— que es justo el punto: obliga a pensarlo dos veces.

Todo lo que crean lleva el prefijo `prueba-` en el id y usa correos
`@conxulty.test` (dominio reservado por norma, nunca va a existir), así que
ninguna prueba toca una fila que no haya creado ella.

## Cómo está armado

No hay framework de pruebas. Cada `.test.mjs` es un programa de Node que se
puede correr solo. Es una dependencia menos que mantener y una capa menos
entre una falla y entender por qué falló. Si algún día son cientos de
pruebas, ahí sí vale meter un corredor de verdad.

- `entorno.mjs` — la guarda de base local, consultas, sesiones falsas,
  aserciones y el informe.
- `sembrar.mjs` — los datos de prueba. Idempotente: se puede correr mil
  veces. `limpiar()` borra en orden de dependencia, y **si agregas una
  tabla nueva que cuelgue de la organización, va en esa lista.**
- `correr-todas.mjs` — las corre en serie (comparten base, en paralelo se
  pisarían).

## Cómo escribir una nueva

Antes de escribirla, la pregunta es: **si esto se rompe, ¿me entero solo?**
Si la respuesta es sí —la pantalla queda en blanco, el botón no hace nada—
no hace falta una prueba. Si la respuesta es no, vale la pena.

Dos costumbres que ya evitaron falsas alarmas acá:

- **Comprobar contra la base, no contra la pantalla.** `esperarEnBase()` en
  vez de buscar un texto: un formulario puede guardar y recién después
  volver a dibujar, y hay palabras que ya estaban en la pantalla antes de
  apretar el botón, así que esperarlas no espera nada.
- **Escribir el nombre de la comprobación en castellano y en términos del
  negocio**, no del código: "No permite dos pacientes en el mismo horario"
  dice qué se perdió si falla; `test conflict 409` no.

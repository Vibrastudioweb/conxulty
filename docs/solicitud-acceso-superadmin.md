# Solicitud de acceso + activación manual (súper-admin)

Flujo para médicos nuevos **sin auto-registro**: el médico pide acceso, el
dueño del sistema lo revisa y crea la cuenta a mano.

```
Landing / formulario ──► solicitudes_acceso (PENDIENTE) ──► email a soporte
                                   │
              /superadmin (rol SUPERADMIN) ──► Activar ──► organización + usuario
                                   │                      + contraseña temporal
                                   └─► Rechazar / Marcar contactado
```

## Piezas

| Pieza | Dónde |
|---|---|
| Tabla `solicitudes_acceso` y enum `EstadoSolicitudAcceso` | `prisma/schema.prisma` |
| Rol `SUPERADMIN` en `RolUsuario` | `prisma/schema.prisma` |
| Migración de esquema | `prisma/migrations/20261013150000_solicitudes_acceso_y_rol_superadmin` |
| Migración de datos (promueve a `gers198710@gmail.com`) | `prisma/migrations/20261013150100_promover_superadmin_inicial` |
| Formulario público | `/solicitar-acceso` |
| API pública (para el landing) | `POST /api/solicitudes-acceso` |
| Email con Resend | `src/modules/solicitudes/email.ts` |
| Panel | `/superadmin` (`src/app/(dashboard)/superadmin`) |
| Guarda | `requireSuperadmin()` en `src/modules/core/autorizacion.ts` |

## Variables de entorno (Render → Environment)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `RESEND_API_KEY` | Sí, para recibir el aviso por email | API key de Resend. Sin ella la solicitud igual se guarda y aparece en `/superadmin`; solo se omite el email (queda un `console.warn`). |
| `RESEND_FROM` | Recomendada | Remitente verificado en Resend, p. ej. `Conxulty <notificaciones@conxulty.com>`. Por defecto `Conxulty <onboarding@resend.dev>`, que **solo entrega al correo dueño de la cuenta de Resend** hasta verificar un dominio. |
| `SOLICITUDES_NOTIFY_TO` | No | Destinatario del aviso. Por defecto `soporte@conxulty.com`. |
| `SOLICITUDES_ALLOWED_ORIGINS` | No | Orígenes CORS extra para la API pública, separados por coma. Ya se permiten `https://conxulty.com` y `https://www.conxulty.com`. |

## Orden de despliegue

El build command de Render **no** corre migraciones
(`npm install && npx prisma generate && npm run build`). Hay que aplicarlas
una vez contra la base de producción, antes o justo después de desplegar
esta rama:

```bash
npx prisma migrate deploy      # usa DIRECT_URL del entorno
```

Las dos migraciones son aditivas (nueva tabla, nuevo valor de enum y un
`UPDATE` de una fila): no tocan datos existentes.

> El rol vive en el JWT de la sesión. Después de la migración, cierra sesión
> y vuelve a entrar para que tu sesión pase a `SUPERADMIN`.

## Integrar el formulario en el landing (conxulty.com)

El landing es un sitio aparte (SvelteKit). Opciones:

1. **Enlace**: el botón "Solicita tu acceso" apunta a
   `https://<dominio-de-la-app>/solicitar-acceso` (ya funciona sin JS).
2. **Formulario propio** que envía a la API:

```js
const r = await fetch("https://<dominio-de-la-app>/api/solicitudes-acceso", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    nombre, email, telefono, nombreConsultorio,
    especialidad,        // opcional
    sitioWeb: "",        // honeypot: dejar vacío (campo oculto en el HTML)
  }),
});
// 201 { ok: true } | 400 { ok:false, campos:[...] } | 429 demasiados intentos
```

## Seguridad

- `/superadmin` y **cada server action** del panel llaman a
  `requireSuperadmin()`: exige rol `SUPERADMIN` en la sesión **y** en la base
  de datos (usuario activo). ADMIN/MEDICO/STAFF son redirigidos a `/`.
- La decisión es una función pura con tests:
  `node --test scripts/test-acceso-superadmin.mjs`.
- La contraseña temporal se genera con `crypto.randomInt` (14 caracteres),
  se guarda con bcrypt (10 rounds) y solo se muestra una vez en pantalla.
- La API pública: validación con Zod, honeypot, límite de 5 solicitudes por
  10 minutos por IP (por instancia), deduplicación por correo (7 días) y CORS
  restringido.

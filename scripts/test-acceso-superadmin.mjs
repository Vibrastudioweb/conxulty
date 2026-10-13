// Ejecutar con: node --test scripts/test-acceso-superadmin.mjs  (Node >= 22.18 / 24: soporta importar .ts)
import { test } from "node:test";
import assert from "node:assert/strict";
import { decidirAccesoSuperadmin } from "../src/modules/core/accesoSuperadmin.ts";

const superadminDb = { rol: "SUPERADMIN", activo: true };

test("sin sesión → login", () => {
  assert.equal(
    decidirAccesoSuperadmin({ rolSesion: undefined, usuarioDb: null }),
    "login",
  );
});

test("SUPERADMIN activo en sesión y en base → permitir", () => {
  assert.equal(
    decidirAccesoSuperadmin({ rolSesion: "SUPERADMIN", usuarioDb: superadminDb }),
    "permitir",
  );
});

test("ADMIN, MEDICO y STAFF de organizaciones normales → denegar", () => {
  for (const rol of ["ADMIN", "MEDICO", "STAFF"]) {
    assert.equal(
      decidirAccesoSuperadmin({
        rolSesion: rol,
        usuarioDb: { rol, activo: true },
      }),
      "denegar",
      `rol ${rol}`,
    );
  }
});

test("token con rol SUPERADMIN pero degradado en base → denegar", () => {
  assert.equal(
    decidirAccesoSuperadmin({
      rolSesion: "SUPERADMIN",
      usuarioDb: { rol: "ADMIN", activo: true },
    }),
    "denegar",
  );
});

test("token con rol SUPERADMIN pero usuario desactivado o inexistente → denegar", () => {
  assert.equal(
    decidirAccesoSuperadmin({
      rolSesion: "SUPERADMIN",
      usuarioDb: { rol: "SUPERADMIN", activo: false },
    }),
    "denegar",
  );
  assert.equal(
    decidirAccesoSuperadmin({ rolSesion: "SUPERADMIN", usuarioDb: null }),
    "denegar",
  );
});

test("rol desconocido o vacío → denegar", () => {
  assert.equal(
    decidirAccesoSuperadmin({ rolSesion: "", usuarioDb: superadminDb }),
    "denegar",
  );
  assert.equal(
    decidirAccesoSuperadmin({ rolSesion: "superadmin", usuarioDb: superadminDb }),
    "denegar",
  );
});

"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface ServicioPrecio {
  nombre: string;
  /** USD. `null` = "a consultar" — el médico puede listar un servicio sin
   *  fijar un precio público. */
  precio: number | null;
}

const MAX_SERVICIOS = 20;

/**
 * Catálogo de servicios con precio propio del médico (Task #13, changelog
 * punto 91/93) — primera de las 4 piezas estilo Doctoralia. A diferencia
 * de la galería de fotos (cada subida es una acción de servidor
 * inmediata), esta es texto/números simples: el estado completo viaja en
 * UN input oculto (`servicios`, JSON) dentro del form principal y se
 * guarda junto con el resto de "Mi ficha pública" al pulsar "Guardar y
 * publicar" — no hace falta una acción de servidor aparte por fila.
 */
export function ServiciosPreciosForm({ serviciosIniciales }: { serviciosIniciales: ServicioPrecio[] }) {
  const [servicios, setServicios] = useState<ServicioPrecio[]>(
    serviciosIniciales.length > 0 ? serviciosIniciales : [{ nombre: "", precio: null }],
  );

  function actualizarNombre(indice: number, nombre: string) {
    setServicios((actual) => actual.map((s, i) => (i === indice ? { ...s, nombre } : s)));
  }

  function actualizarPrecio(indice: number, texto: string) {
    const precio = texto.trim() === "" ? null : Number(texto);
    setServicios((actual) =>
      actual.map((s, i) => (i === indice ? { ...s, precio: Number.isFinite(precio) ? precio : null } : s)),
    );
  }

  function agregarFila() {
    setServicios((actual) => [...actual, { nombre: "", precio: null }]);
  }

  function quitarFila(indice: number) {
    setServicios((actual) => actual.filter((_, i) => i !== indice));
  }

  // Filas realmente vacías (sin nombre) no viajan al guardar — evita que
  // una fila en blanco que el médico dejó sin llenar se guarde como
  // servicio "sin nombre".
  const serviciosParaGuardar = servicios.filter((s) => s.nombre.trim() !== "");

  return (
    <div className="space-y-3">
      <input type="hidden" name="servicios" value={JSON.stringify(serviciosParaGuardar)} />

      {servicios.map((servicio, indice) => (
        <div key={indice} className="flex items-start gap-2">
          <div className="flex-1">
            <Input
              aria-label="Servicio"
              placeholder="Ej.: Consulta general"
              value={servicio.nombre}
              onChange={(e) => actualizarNombre(indice, e.target.value)}
              maxLength={160}
            />
          </div>
          <div className="w-32">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-faint">
                $
              </span>
              <Input
                aria-label="Precio en dólares"
                type="number"
                min={0}
                step="0.01"
                placeholder="A consultar"
                className="pl-6"
                value={servicio.precio ?? ""}
                onChange={(e) => actualizarPrecio(indice, e.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => quitarFila(indice)}
            aria-label="Quitar este servicio"
          >
            ✕
          </Button>
        </div>
      ))}

      {servicios.length < MAX_SERVICIOS && (
        <Button type="button" variant="secondary" size="sm" onClick={agregarFila}>
          + Agregar servicio
        </Button>
      )}

      <p className="text-caption text-text-faint">
        Deja el precio en blanco si prefieres que diga &ldquo;a consultar&rdquo;.
      </p>
    </div>
  );
}

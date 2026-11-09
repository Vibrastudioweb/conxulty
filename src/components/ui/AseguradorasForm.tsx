"use client";

import { useState } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

const MAX_ASEGURADORAS = 15;

/**
 * Aseguradoras que el médico acepta (Task #14, changelog punto 91/95) —
 * segunda de las 4 piezas estilo Doctoralia, mismo patrón que
 * ServiciosPreciosForm.tsx: lista de texto libre (sin catálogo cerrado —
 * no se investigó ninguno compartido con el Directorio ni con el resto
 * del OS), todo el estado viaja en UN input oculto JSON dentro del form
 * principal, se guarda junto con el resto de "Mi ficha pública".
 */
export function AseguradorasForm({ aseguradorasIniciales }: { aseguradorasIniciales: string[] }) {
  const [aseguradoras, setAseguradoras] = useState<string[]>(
    aseguradorasIniciales.length > 0 ? aseguradorasIniciales : [""],
  );

  function actualizar(indice: number, valor: string) {
    setAseguradoras((actual) => actual.map((a, i) => (i === indice ? valor : a)));
  }

  function agregarFila() {
    setAseguradoras((actual) => [...actual, ""]);
  }

  function quitarFila(indice: number) {
    setAseguradoras((actual) => actual.filter((_, i) => i !== indice));
  }

  // Filas vacías no viajan al guardar (mismo criterio que
  // ServiciosPreciosForm.tsx: una fila en blanco no se guarda como dato).
  const aseguradorasParaGuardar = aseguradoras.map((a) => a.trim()).filter((a) => a !== "");

  return (
    <div className="space-y-3">
      <input type="hidden" name="aseguradoras" value={JSON.stringify(aseguradorasParaGuardar)} />

      {aseguradoras.map((aseguradora, indice) => (
        <div key={indice} className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              aria-label="Aseguradora"
              placeholder="Ej.: Mapfre, Seguros Caracas, La Previsora…"
              value={aseguradora}
              onChange={(e) => actualizar(indice, e.target.value)}
              maxLength={160}
            />
          </div>
          <Button
            type="button"
            variant="ghost"
            size="md"
            onClick={() => quitarFila(indice)}
            aria-label="Quitar esta aseguradora"
          >
            ✕
          </Button>
        </div>
      ))}

      {aseguradoras.length < MAX_ASEGURADORAS && (
        <Button type="button" variant="secondary" size="sm" onClick={agregarFila}>
          + Agregar aseguradora
        </Button>
      )}

      <p className="text-caption text-text-faint">
        Deja esto vacío si no trabajas con seguros médicos — la sección no aparece en tu ficha pública.
      </p>
    </div>
  );
}

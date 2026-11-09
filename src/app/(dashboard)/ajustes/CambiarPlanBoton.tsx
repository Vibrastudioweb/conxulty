"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { iniciarCambioPlan } from "./actions";

/**
 * Botón real (no decorativo): llama a `iniciarCambioPlan`, que hoy siempre
 * devuelve el error de SPIDI-no-configurado (ver spidi.ts) — se muestra
 * ese error tal cual en vez de fingir que el cambio de plan funciona.
 */
export function CambiarPlanBoton({
  plan,
  etiqueta,
  variant = "primary",
}: {
  plan: "FICHA" | "PRO";
  etiqueta: string;
  variant?: "primary" | "secondary";
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function alHacerClic() {
    setError(null);
    startTransition(async () => {
      const resultado = await iniciarCambioPlan(plan);
      if (!resultado.ok) {
        setError(resultado.error ?? "No se pudo procesar el cambio de plan.");
      }
    });
  }

  return (
    <div>
      <Button variant={variant} size="sm" loading={pending} onClick={alHacerClic}>
        {etiqueta}
      </Button>
      {error && (
        <div className="mt-3">
          <Alert tone="warning" title="Todavía no disponible">
            {error}
          </Alert>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  CUADRANTES_FDI,
  ESTADOS_DIENTE,
  LABEL_ESTADO_DIENTE,
  COLOR_ESTADO_DIENTE,
  type EstadoDiente,
  type Odontograma,
} from "@/modules/consultas/odontograma";

/**
 * Diagrama clickeable del odontograma (ver changelog punto 51b, pedido
 * explícito del usuario: "debería ver el gráfico... seleccionar" — en vez
 * de los 32 <select> de la primera versión). Primer componente de cliente
 * de esta pantalla (ya hay otros "use client" en la app — toasts, un
 * formulario de activación — así que no es un patrón nuevo, solo el primer
 * uso aquí): un click en un diente avanza al siguiente estado del catálogo
 * cerrado y lo refleja en un <input type="hidden"> con el mismo nombre
 * (`diente_<FDI>`) que ya leía la Server Action — el envío del formulario
 * no cambió, solo cómo se edita antes de enviar.
 *
 * El dibujo es deliberadamente simple (una corona + dos raíces, mismo
 * trazo para los 32 dientes) — no es anatómicamente distinto por tipo de
 * diente (incisivo/canino/molar), porque eso es detalle visual que no
 * aporta nada clínico al estado que se está registrando. Es un ícono, no
 * una ilustración.
 */

function siguienteEstado(actual: EstadoDiente): EstadoDiente {
  const indice = ESTADOS_DIENTE.indexOf(actual);
  return ESTADOS_DIENTE[(indice + 1) % ESTADOS_DIENTE.length];
}

function DienteIcono({ estado }: { estado: EstadoDiente }) {
  const color = COLOR_ESTADO_DIENTE[estado];
  const ausente = estado === "AUSENTE";
  return (
    <svg viewBox="0 0 24 32" width="30" height="40" aria-hidden="true">
      <g opacity={ausente ? 0.35 : 1}>
        <rect x="4" y="2" width="16" height="13" rx="7" fill={color} stroke="#8a9699" strokeWidth="1" />
        <path
          d="M8 13 L5 29 L10.5 21 Z"
          fill={color}
          stroke="#8a9699"
          strokeWidth="1"
          strokeLinejoin="round"
        />
        <path
          d="M16 13 L19 29 L13.5 21 Z"
          fill={color}
          stroke="#8a9699"
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </g>
      {ausente && <line x1="3" y1="4" x2="21" y2="30" stroke="#c94a4a" strokeWidth="2" />}
    </svg>
  );
}

export function OdontogramaDiagrama({ odontograma }: { odontograma: Odontograma }) {
  const [estados, setEstados] = useState<Record<string, EstadoDiente>>(() => {
    const inicial: Record<string, EstadoDiente> = {};
    for (const cuadrante of CUADRANTES_FDI) {
      for (const numero of cuadrante.dientes) {
        inicial[numero] = odontograma[numero] ?? "SANO";
      }
    }
    return inicial;
  });

  function ciclar(numero: string) {
    setEstados((previo) => ({ ...previo, [numero]: siguienteEstado(previo[numero]) }));
  }

  return (
    <div className="space-y-3">
      {CUADRANTES_FDI.map((cuadrante) => (
        <Card key={cuadrante.nombre} padding="cozy">
          <p className="text-caption font-semibold text-text-secondary">{cuadrante.nombre}</p>
          <div className="mt-2 grid grid-cols-4 gap-1 sm:grid-cols-8">
            {cuadrante.dientes.map((numero) => {
              const estado = estados[numero];
              return (
                <button
                  key={numero}
                  type="button"
                  onClick={() => ciclar(numero)}
                  title={`${LABEL_ESTADO_DIENTE[estado]} — clic para cambiar`}
                  aria-label={`Diente ${numero}: ${LABEL_ESTADO_DIENTE[estado]}. Clic para cambiar de estado.`}
                  className="flex flex-col items-center gap-0.5 rounded p-1 transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  <DienteIcono estado={estado} />
                  <span className="text-xs text-text-faint">{numero}</span>
                  <input type="hidden" name={`diente_${numero}`} value={estado} />
                </button>
              );
            })}
          </div>
        </Card>
      ))}

      <div className="flex flex-wrap gap-3 rounded-card border border-border bg-surface-muted px-3 py-2 text-caption text-text-secondary">
        {ESTADOS_DIENTE.map((estado) => (
          <span key={estado} className="flex items-center gap-1.5">
            <span
              className="inline-block h-3 w-3 rounded-full border border-border"
              style={{ backgroundColor: COLOR_ESTADO_DIENTE[estado] }}
            />
            {LABEL_ESTADO_DIENTE[estado]}
          </span>
        ))}
      </div>
      <p className="text-caption text-text-faint">
        Haz clic sobre un diente para pasar al siguiente estado de la lista (se repite en ciclo).
      </p>
    </div>
  );
}

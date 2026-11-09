"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { guardarFichaEntidadAction, type GuardarFichaEntidadResultado } from "./actions";
import type { CiudadDirectorio, FichaEntidadDirectorio } from "@/modules/directorio/sincronizacionEntidad";
import { DIAS_SEMANA, type HorarioDia } from "@/modules/onboarding/horarioSede";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import type { Entidad } from "@prisma/client";

const LABEL = "mb-1 block text-sm font-medium text-text-primary";
const SELECT_CLASES =
  "w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary";

export function FichaEntidadForm({
  nombre,
  entidad,
  ficha,
  ciudades,
}: {
  nombre: string;
  entidad: Entidad;
  ficha: FichaEntidadDirectorio | null;
  ciudades: CiudadDirectorio[];
}) {
  const [resultado, accion, pendiente] = useActionState<GuardarFichaEntidadResultado, FormData>(
    guardarFichaEntidadAction,
    null,
  );

  // El horario que ya tiene guardado en el OS es la fuente de verdad para
  // precargar el formulario — no el del Directorio (que solo refleja el
  // último sync, nunca se edita directo ahí).
  const horarioActual = (entidad.horario as unknown as HorarioDia[] | null) ?? [];
  const horarioPorDia = new Map(horarioActual.map((h) => [h.dia, h]));

  return (
    <form action={accion} className="space-y-6">
      {resultado?.ok === false && (
        <Alert tone="danger" title="No se guardó">
          {resultado.error}
        </Alert>
      )}
      {resultado?.ok === true && <Alert tone="success">Ficha guardada y sincronizada.</Alert>}

      <Card padding="spacious">
        <h2 className="text-sm font-semibold text-text-primary">Tu centro</h2>
        <div className="mt-3 space-y-3">
          <div>
            <label htmlFor="nombre" className={LABEL}>
              Nombre del centro
            </label>
            <Input id="nombre" name="nombre" defaultValue={nombre} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="municipio" className={LABEL}>
                Municipio
              </label>
              <select
                id="municipio"
                name="municipio"
                defaultValue={entidad.municipio ?? ""}
                className={SELECT_CLASES}
              >
                <option value="">— Selecciona —</option>
                {MUNICIPIOS_TRUJILLO.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="telefono" className={LABEL}>
                Teléfono
              </label>
              <Input id="telefono" name="telefono" defaultValue={entidad.telefono ?? ""} />
            </div>
          </div>
          <div>
            <label htmlFor="direccion" className={LABEL}>
              Dirección
            </label>
            <Input id="direccion" name="direccion" defaultValue={entidad.direccion ?? ""} />
          </div>
          <div>
            <label htmlFor="ciudadDirectorioId" className={LABEL}>
              Ciudad en el Directorio
            </label>
            <select
              id="ciudadDirectorioId"
              name="ciudadDirectorioId"
              defaultValue={ficha?.ciudad_id ?? ""}
              className={SELECT_CLASES}
            >
              <option value="">— Selecciona —</option>
              {ciudades.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
            <p className="mt-1 text-caption text-text-faint">
              Catálogo del Directorio — distinto al municipio de arriba, elige la ciudad real para que te
              encuentren por ubicación.
            </p>
          </div>
        </div>
      </Card>

      <Card padding="spacious">
        <h2 className="text-sm font-semibold text-text-primary">Horario de atención</h2>
        <div className="mt-3 space-y-2">
          {DIAS_SEMANA.map((dia) => {
            const actual = horarioPorDia.get(dia);
            return (
              <div key={dia} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5 text-text-primary">
                  <input type="checkbox" name={`horario_${dia}_atiende`} defaultChecked={actual?.atiende ?? false} />
                  {dia}
                </label>
                <input
                  type="time"
                  name={`horario_${dia}_horaInicio`}
                  defaultValue={actual?.horaInicio ?? ""}
                  className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
                />
                <input
                  type="time"
                  name={`horario_${dia}_horaFin`}
                  defaultValue={actual?.horaFin ?? ""}
                  className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Button type="submit" disabled={pendiente}>
        {pendiente ? "Guardando…" : "Guardar"}
      </Button>
    </form>
  );
}

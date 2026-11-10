"use client";

import { useActionState, useRef } from "react";
import dynamic from "next/dynamic";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { RecortadorFoto } from "@/components/ui/RecortadorFoto";
import { GaleriaFotosForm } from "@/components/ui/GaleriaFotosForm";
import { ServiciosPreciosForm } from "@/components/ui/ServiciosPreciosForm";
import { AseguradorasForm } from "@/components/ui/AseguradorasForm";
import { guardarFichaPublicaAction, type GuardarFichaPublicaResultado } from "./actions";
import { agregarFotoGaleriaMedicoAction, quitarFotoGaleriaMedicoAction } from "./galeriaActions";
import type {
  CiudadDirectorio,
  EspecialidadDirectorio,
  FichaDirectorio,
  SedeDirectorio,
} from "@/modules/directorio/sincronizacion";
import { MUNICIPIOS_TRUJILLO } from "@/modules/onboarding/municipiosTrujillo";
import { MODALIDADES_ATENCION, LABEL_MODALIDAD, type ModalidadAtencionId } from "@/modules/onboarding/modalidades";
import { DIAS_SEMANA, type HorarioDia } from "@/modules/onboarding/horarioSede";
import type { ProfesionId } from "@/modules/onboarding/profesiones";

/** Mismo componente que `HorarioSedeFields` de /registro (page.tsx) — se
 *  copia en vez de compartirse porque ese vive en un Server Component y
 *  este archivo es "use client"; no usa hooks, así que no hay diferencia
 *  real salvo precargar el horario que la sede ya tenga guardado. */
function HorarioSedeFields({
  prefijoSede,
  horarioActual,
}: {
  prefijoSede: string;
  horarioActual?: HorarioDia[];
}) {
  const porDia = new Map((horarioActual ?? []).map((h) => [h.dia, h]));
  return (
    <details className="rounded-input border border-border px-3 py-2">
      <summary className="cursor-pointer text-sm text-text-secondary">
        + Horario de atención (opcional)
      </summary>
      <div className="mt-3 space-y-2">
        {DIAS_SEMANA.map((dia) => {
          const h = porDia.get(dia);
          return (
            <div key={dia} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5 text-text-primary">
                <input type="checkbox" name={`${prefijoSede}_${dia}_atiende`} defaultChecked={h?.atiende ?? false} />
                {dia}
              </label>
              <input
                type="time"
                name={`${prefijoSede}_${dia}_horaInicio`}
                defaultValue={h?.horaInicio ?? ""}
                className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
              />
              <input
                type="time"
                name={`${prefijoSede}_${dia}_horaFin`}
                defaultValue={h?.horaFin ?? ""}
                className="rounded-input border border-border bg-surface px-2 py-1 text-sm"
              />
            </div>
          );
        })}
      </div>
    </details>
  );
}

/** Mismos campos (municipio/dirección/teléfono/referencia/horario) para
 *  una sede nueva — igual que `SedeFields` de /registro, sin ciudad del
 *  Directorio ni mapa todavía (eso se elige recién cuando ya tenga un
 *  `id` real, en el próximo guardado). */
function SedeNuevaFields({ numero }: { numero: number }) {
  const prefijo = `sedeNueva${numero}`;
  return (
    <div className="space-y-3 rounded-input border border-dashed border-border p-3">
      <p className="text-sm font-semibold text-text-primary">Sede nueva</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor={`${prefijo}_municipio`}>
            Municipio
          </label>
          <select id={`${prefijo}_municipio`} name={`${prefijo}_municipio`} defaultValue="" className={SELECT_CLASES}>
            <option value="">— Selecciona —</option>
            {MUNICIPIOS_TRUJILLO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor={`${prefijo}_telefono`}>
            Teléfono (opcional)
          </label>
          <Input id={`${prefijo}_telefono`} name={`${prefijo}_telefono`} />
        </div>
      </div>
      <div>
        <label className={LABEL} htmlFor={`${prefijo}_direccion`}>
          Dirección
        </label>
        <Input id={`${prefijo}_direccion`} name={`${prefijo}_direccion`} />
      </div>
      <div>
        <label className={LABEL} htmlFor={`${prefijo}_referencia`}>
          Referencia (opcional)
        </label>
        <Input id={`${prefijo}_referencia`} name={`${prefijo}_referencia`} />
      </div>
      <HorarioSedeFields prefijoSede={prefijo} />
      <p className="text-caption text-text-faint">
        La ciudad del Directorio, consultorio/sector y el punto en el mapa se eligen después de guardar esta, cuando ya tenga su propio registro.
      </p>
    </div>
  );
}

// Leaflet necesita `window` al cargar — sin esto, Next intenta renderizar
// el mapa en el servidor y rompe. `ssr: false` lo deja solo para el cliente.
const MapaSede = dynamic(() => import("@/components/ui/MapaSede").then((m) => m.MapaSede), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-input border border-border text-caption text-text-faint">
      Cargando mapa…
    </div>
  ),
});

const LABEL = "mb-1 block text-sm font-medium text-text-primary";
const SELECT_CLASES =
  "w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary";

export function FichaPublicaForm({
  ficha,
  ciudades,
  sedesDirectorio,
  sedesOs,
  espaciosNuevaSede,
  modalidadesActuales,
  profesion,
  cedula,
  numeroMpps,
  numeroColegiado,
  especialidadesSecundarias,
  zonasCobertura,
  especialidades,
  especialidadId,
}: {
  ficha: FichaDirectorio | null;
  ciudades: CiudadDirectorio[];
  sedesDirectorio: SedeDirectorio[];
  sedesOs: {
    id: string;
    municipio: string;
    direccion: string;
    referencia: string | null;
    telefono: string | null;
    horario: HorarioDia[];
  }[];
  /** Cupos libres para "+ Agregar sede" — `SEDES_MAX` menos las que ya
   *  existen (ver page.tsx). */
  espaciosNuevaSede: number;
  modalidadesActuales: ModalidadAtencionId[];
  profesion: ProfesionId;
  cedula: string | null;
  numeroMpps: string | null;
  numeroColegiado: string | null;
  especialidadesSecundarias: string[];
  zonasCobertura: string[];
  especialidades: EspecialidadDirectorio[];
  especialidadId: string | null;
}) {
  const [resultado, accion, pendiente] = useActionState<GuardarFichaPublicaResultado, FormData>(
    guardarFichaPublicaAction,
    null,
  );

  // La foto no se manda como texto: se recorta/convierte a webp en el
  // navegador (RecortadorFoto) y se deja en este input oculto vía
  // DataTransfer, para que viaje como archivo dentro del mismo FormData
  // del form principal al enviar — ver changelog punto 86.
  const fotoInputRef = useRef<HTMLInputElement | null>(null);

  function alRecortarFoto(blob: Blob) {
    const archivo = new File([blob], "foto.webp", { type: "image/webp" });
    const dt = new DataTransfer();
    dt.items.add(archivo);
    if (fotoInputRef.current) fotoInputRef.current.files = dt.files;
  }

  // Precarga la ciudad del Directorio ya elegida antes para cada sede,
  // emparejando por dirección (es lo único comparable entre los dos lados
  // — ver sincronizacion.ts sobre por qué municipio≠ciudad).
  const ciudadPorDireccion = new Map(sedesDirectorio.map((s) => [s.direccion, s.ciudad_id]));
  // Mismo emparejamiento por dirección, para precargar el punto del mapa
  // que ya se haya marcado antes (ver MapaSede.tsx).
  const puntoPorDireccion = new Map(sedesDirectorio.map((s) => [s.direccion, { lat: s.lat, lng: s.lng }]));
  // 10-nov-2026: mismo emparejamiento, para "piso/consultorio" y "sector" —
  // columnas nuevas del lado del Directorio, antes el OS no las capturaba.
  const consultorioPorDireccion = new Map(sedesDirectorio.map((s) => [s.direccion, s.consultorio]));
  const sectorPorDireccion = new Map(sedesDirectorio.map((s) => [s.direccion, s.sector]));

  // Agrupa el catálogo de especialidades por `grupo` para el <select> —
  // mismo criterio visual que usa el propio Directorio, sin inventar
  // agrupaciones nuevas.
  const especialidadesPorGrupo = new Map<string, EspecialidadDirectorio[]>();
  for (const e of especialidades) {
    const clave = e.grupo ?? "Otras";
    especialidadesPorGrupo.set(clave, [...(especialidadesPorGrupo.get(clave) ?? []), e]);
  }

  return (
    <form action={accion} className="space-y-6">
      {resultado?.ok === false && <Alert tone="danger">{resultado.error}</Alert>}
      {resultado?.ok === true && (
        <Alert tone="success" title="Guardado">
          Tu ficha pública quedó actualizada en conxulty.com/medico/{resultado.slug}
        </Alert>
      )}
      {resultado?.ok === true && resultado.advertenciaFoto && (
        <Alert tone="warning" title="La foto no se pudo actualizar">
          {resultado.advertenciaFoto} El resto de los cambios sí se guardó.
        </Alert>
      )}
      {resultado?.ok === true && resultado.advertenciaChoques && (
        <Alert tone="warning" title="Choque de horario entre tus sedes">
          {resultado.advertenciaChoques} No bloquea el guardado — pero revisa si es un error.
        </Alert>
      )}

      {/* Reorganizado en tarjetas por tema (10-nov-2026, pedido del usuario:
          "mejorar organizacion y diseño de esto") — antes era un único
          flujo plano de ~9 secciones sin agrupar. Ningún `name` de campo
          cambia, así que `guardarFichaPublicaAction` sigue leyendo el
          mismo FormData de siempre. */}
      <Card padding="spacious" className="space-y-4">
        <SectionLabel>Identidad visual</SectionLabel>
        <div>
          <RecortadorFoto
            etiqueta="Foto de perfil"
            fotoActualUrl={ficha?.foto_url ?? null}
            onRecortada={alRecortarFoto}
            mostrarEjemplo
            textoEjemplo="Medio cuerpo, con la cara en la parte de arriba. Así se ve mejor en tu ficha."
          />
          <input ref={fotoInputRef} type="file" name="foto" className="hidden" accept="image/webp" />
        </div>
        <div className="border-t border-border pt-4">
          <p className={LABEL}>Fotos del consultorio</p>
          <GaleriaFotosForm
            fotosIniciales={ficha?.galeria ?? []}
            agregarAction={agregarFotoGaleriaMedicoAction}
            quitarAction={quitarFotoGaleriaMedicoAction}
          />
        </div>
      </Card>

      <Card padding="spacious" className="space-y-4">
        <SectionLabel>Servicios, precios y seguros</SectionLabel>
        <div>
          <p className={LABEL}>Servicios y precios</p>
          <ServiciosPreciosForm serviciosIniciales={ficha?.servicios ?? []} />
        </div>
        <div className="border-t border-border pt-4">
          <p className={LABEL}>Aseguradoras que aceptas</p>
          <AseguradorasForm aseguradorasIniciales={ficha?.aseguradoras ?? []} />
        </div>
      </Card>

      <Card padding="spacious" className="space-y-4">
        <SectionLabel>Sobre ti</SectionLabel>
        <div>
          <label className={LABEL} htmlFor="descripcion">
            Descripción
          </label>
          <Textarea
            id="descripcion"
            name="descripcion"
            rows={4}
            placeholder="Lo que un paciente nuevo debería saber de ti."
            defaultValue={ficha?.descripcion ?? ""}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="instagram">
              Instagram
            </label>
            <Input id="instagram" name="instagram" placeholder="@tuusuario" defaultValue={ficha?.instagram ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="sitioWeb">
              Sitio web
            </label>
            <Input id="sitioWeb" name="sitioWeb" type="url" placeholder="https://…" defaultValue={ficha?.sitio_web ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="correo">
              Correo público
            </label>
            <Input id="correo" name="correo" type="email" defaultValue={ficha?.correo ?? ""} />
          </div>
          <div>
            <label className={LABEL} htmlFor="rif">
              RIF
            </label>
            <Input id="rif" name="rif" defaultValue={ficha?.rif ?? ""} />
          </div>
        </div>

        <div>
          <label className={LABEL} htmlFor="domicilioFiscal">
            Domicilio fiscal
          </label>
          <Input id="domicilioFiscal" name="domicilioFiscal" defaultValue={ficha?.domicilio_fiscal ?? ""} />
        </div>

        {/* 10-nov-2026: antes esto no existía — el OS guarda `especialidad`
            como texto libre y el Directorio usa catálogo cerrado, mapear a
            ciegas generaba coincidencias falsas. Acá el médico ELIGE la
            suya del catálogo real (nunca se adivina ni se guarda sola:
            recién al tocar "Guardar y publicar"). Si el texto que ya tenía
            coincidía exacto con una opción, viene preseleccionada. */}
        <div className="border-t border-border pt-4">
          <label className={LABEL} htmlFor="especialidadId">
            Especialidad (como aparece en el Directorio)
          </label>
          <select id="especialidadId" name="especialidadId" defaultValue={especialidadId ?? ""} className={SELECT_CLASES}>
            <option value="">— Sin elegir —</option>
            {[...especialidadesPorGrupo.entries()].map(([grupo, lista]) => (
              <optgroup key={grupo} label={grupo}>
                {lista.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nombre}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-caption text-text-faint">
            Es la que ve el paciente en tu ficha — distinta de la que elegiste al registrarte, que es solo interna.
          </p>
        </div>

        {/* 10-nov-2026: cédula, MPPS, colegiado y especialidad secundaria se
            sacaron del registro ("menos pasos") — se llenan/editan acá. */}
        <div className="border-t border-border pt-4">
          <p className={LABEL}>Credenciales</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL} htmlFor="cedula">
                Cédula
              </label>
              <Input id="cedula" name="cedula" defaultValue={cedula ?? ""} />
            </div>
            {profesion === "MEDICO" && (
              <div>
                <label className={LABEL} htmlFor="numeroMpps">
                  N.º de MPPS
                </label>
                <Input id="numeroMpps" name="numeroMpps" defaultValue={numeroMpps ?? ""} />
                <p className="mt-1 text-caption text-text-faint">No se publica en tu ficha.</p>
              </div>
            )}
            <div>
              <label className={LABEL} htmlFor="numeroColegiado">
                N.º de colegiado
              </label>
              <Input id="numeroColegiado" name="numeroColegiado" defaultValue={numeroColegiado ?? ""} />
            </div>
            <div>
              <label className={LABEL} htmlFor="especialidadSecundaria1">
                Especialidad secundaria
              </label>
              <Input
                id="especialidadSecundaria1"
                name="especialidadSecundaria1"
                defaultValue={especialidadesSecundarias[0] ?? ""}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card padding="spacious" className="space-y-4">
        <SectionLabel>Cómo atiendes</SectionLabel>
        {/* 10-nov-2026, pedido del usuario ("donde edita un medico sedes
            horarios y ubicaciones y modalidad de consultas"): antes esto
            solo se fijaba una vez en /registro y no había forma de
            cambiarlo después. Mismos checkboxes, mismos nombres de campo
            (`modalidad_<ID>`) que ese formulario. */}
        <div className="flex flex-wrap gap-4">
          {MODALIDADES_ATENCION.map((m) => (
            <label key={m} className="flex items-center gap-2 text-sm text-text-primary">
              <input type="checkbox" name={`modalidad_${m}`} defaultChecked={modalidadesActuales.includes(m)} />
              {LABEL_MODALIDAD[m]}
            </label>
          ))}
        </div>
        <p className="text-caption text-text-faint">
          Si desmarcas &quot;Presencial en consultorio&quot;, tus sedes dejan de usarse para agendar (pero no se borran).
        </p>
      </Card>

      <Card padding="spacious" className="space-y-4">
        <SectionLabel>Sedes</SectionLabel>

        {sedesOs.length > 0 && (
          <div className="space-y-4">
            <p className="text-caption text-text-secondary">
              Esto es lo mismo que usa tu agenda — un cambio acá se refleja
              ahí también. El municipio que usás para agendar y la ciudad
              del Directorio son catálogos distintos, por eso hay dos
              selectores de ubicación por sede.
            </p>
            {sedesOs.map((sede) => (
              <fieldset key={sede.id} className="space-y-3 rounded-input border border-border p-3">
                <legend className="sr-only">Sede en {sede.direccion}</legend>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={LABEL} htmlFor={`sedeOs_${sede.id}_municipio`}>
                      Municipio
                    </label>
                    <select
                      id={`sedeOs_${sede.id}_municipio`}
                      name={`sedeOs_${sede.id}_municipio`}
                      defaultValue={sede.municipio}
                      className={SELECT_CLASES}
                    >
                      {MUNICIPIOS_TRUJILLO.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={LABEL} htmlFor={`sedeOs_${sede.id}_telefono`}>
                      Teléfono (opcional)
                    </label>
                    <Input
                      id={`sedeOs_${sede.id}_telefono`}
                      name={`sedeOs_${sede.id}_telefono`}
                      defaultValue={sede.telefono ?? ""}
                    />
                  </div>
                </div>
                <div>
                  <label className={LABEL} htmlFor={`sedeOs_${sede.id}_direccion`}>
                    Dirección
                  </label>
                  <Input
                    id={`sedeOs_${sede.id}_direccion`}
                    name={`sedeOs_${sede.id}_direccion`}
                    defaultValue={sede.direccion}
                  />
                </div>
                <div>
                  <label className={LABEL} htmlFor={`sedeOs_${sede.id}_referencia`}>
                    Referencia (opcional)
                  </label>
                  <Input
                    id={`sedeOs_${sede.id}_referencia`}
                    name={`sedeOs_${sede.id}_referencia`}
                    defaultValue={sede.referencia ?? ""}
                  />
                </div>
                <HorarioSedeFields prefijoSede={`sedeOs_${sede.id}`} horarioActual={sede.horario} />

                <div className="border-t border-border pt-3">
                  <label className={LABEL} htmlFor={`ciudadSede_${sede.id}`}>
                    Ciudad en el Directorio (conxulty.com)
                  </label>
                  <select
                    id={`ciudadSede_${sede.id}`}
                    name={`ciudadSede_${sede.id}`}
                    defaultValue={ciudadPorDireccion.get(sede.direccion) ?? ""}
                    className={SELECT_CLASES}
                  >
                    <option value="">Sin elegir — no aparece en el Directorio</option>
                    {ciudades.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={LABEL} htmlFor={`consultorioSede_${sede.id}`}>
                        Piso / consultorio (opcional)
                      </label>
                      <Input
                        id={`consultorioSede_${sede.id}`}
                        name={`consultorioSede_${sede.id}`}
                        placeholder="Ej.: Piso 3, consultorio 302"
                        defaultValue={consultorioPorDireccion.get(sede.direccion) ?? ""}
                      />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`sectorSede_${sede.id}`}>
                        Sector (opcional)
                      </label>
                      <Input
                        id={`sectorSede_${sede.id}`}
                        name={`sectorSede_${sede.id}`}
                        placeholder="Ej.: Las Acacias"
                        defaultValue={sectorPorDireccion.get(sede.direccion) ?? ""}
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <MapaSede
                      sedeId={sede.id}
                      etiqueta={sede.direccion}
                      lat={puntoPorDireccion.get(sede.direccion)?.lat ?? null}
                      lng={puntoPorDireccion.get(sede.direccion)?.lng ?? null}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 border-t border-border pt-3 text-sm text-danger-text">
                  <input type="checkbox" name={`sedeOs_${sede.id}_eliminar`} />
                  Eliminar esta sede
                </label>
              </fieldset>
            ))}
          </div>
        )}

        {espaciosNuevaSede > 0 && (
          <details className="group rounded-input border border-dashed border-border p-3">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-button border border-brand-primary px-4 py-2 text-body-secondary font-semibold text-brand-primary hover:bg-brand-primary-soft [&::-webkit-details-marker]:hidden">
              + Agregar sede
            </summary>
            <div className="mt-3 space-y-3">
              {Array.from({ length: espaciosNuevaSede }, (_, i) => (
                <SedeNuevaFields key={i} numero={i + 1} />
              ))}
            </div>
          </details>
        )}

        <div className="border-t border-border pt-4">
          <label className={LABEL} htmlFor="zonasCobertura">
            Zonas de cobertura a domicilio
          </label>
          <select
            id="zonasCobertura"
            name="zonasCobertura"
            multiple
            size={8}
            defaultValue={zonasCobertura}
            className={SELECT_CLASES}
          >
            {MUNICIPIOS_TRUJILLO.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <p className="mt-1 text-caption text-text-faint">
            Solo se usa si marcaste &quot;A domicilio&quot; arriba. Mantén Ctrl (o Cmd) presionado para elegir varias.
          </p>
        </div>
        {/* 10-nov-2026: "Disponibilidad" se saca de acá — pedido del
            usuario tras confirmar que esa columna nunca se imprime en
            ningún lado de la ficha pública (medico/[slug]/+page.svelte,
            vitalud, nunca la lee), así que era un campo que se guardaba
            sin ningún destino. Mismo cambio del lado de vitalud
            (fichaProfesional.js, CAMPOS_SIMPLES). */}
      </Card>

      <Button type="submit" loading={pendiente} fullWidth size="lg">
        Guardar y publicar
      </Button>
    </form>
  );
}

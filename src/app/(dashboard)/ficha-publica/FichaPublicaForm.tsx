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
import type { CiudadDirectorio, FichaDirectorio, SedeDirectorio } from "@/modules/directorio/sincronizacion";

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
}: {
  ficha: FichaDirectorio | null;
  ciudades: CiudadDirectorio[];
  sedesDirectorio: SedeDirectorio[];
  sedesOs: { id: string; municipio: string; direccion: string }[];
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
      </Card>

      <Card padding="spacious" className="space-y-4">
        <SectionLabel>Sedes y disponibilidad</SectionLabel>

        {sedesOs.length > 0 && (
          <fieldset className="space-y-4">
            <legend className="sr-only">Ciudad de cada sede (para el Directorio)</legend>
            <p className="text-caption text-text-secondary">
              El municipio que usás para tu agenda y la ciudad del Directorio
              son catálogos distintos — elegí acá la ciudad real donde aparece
              cada sede en conxulty.com.
            </p>
            {sedesOs.map((sede) => (
              <div key={sede.id} className="rounded-input border border-border p-3">
                <label className={LABEL} htmlFor={`ciudadSede_${sede.id}`}>
                  {sede.direccion} <span className="text-text-faint">({sede.municipio})</span>
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
                <div className="mt-3">
                  <MapaSede
                    sedeId={sede.id}
                    etiqueta={sede.direccion}
                    lat={puntoPorDireccion.get(sede.direccion)?.lat ?? null}
                    lng={puntoPorDireccion.get(sede.direccion)?.lng ?? null}
                  />
                </div>
              </div>
            ))}
          </fieldset>
        )}

        <div className={sedesOs.length > 0 ? "border-t border-border pt-4" : ""}>
          <label className={LABEL} htmlFor="disponibilidad">
            Disponibilidad (si atiendes a domicilio)
          </label>
          <Input
            id="disponibilidad"
            name="disponibilidad"
            placeholder="Ej.: lunes a viernes, tardes"
            defaultValue={ficha?.disponibilidad ?? ""}
          />
        </div>
      </Card>

      <Button type="submit" loading={pendiente} fullWidth size="lg">
        Guardar y publicar
      </Button>
    </form>
  );
}

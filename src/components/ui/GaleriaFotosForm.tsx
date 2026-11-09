"use client";

import { useState, useTransition } from "react";
import { RecortadorFoto } from "@/components/ui/RecortadorFoto";
import { Alert } from "@/components/ui/Alert";

const MAX_FOTOS = 6;

export type ResultadoAccionGaleria = { ok: true; galeria: string[] } | { ok: false; error: string };

/**
 * Galería de hasta 6 fotos (Task #11, changelog punto 90/92) — compartida
 * por "Mi ficha pública" de médico y de entidad (clínica/farmacia), cada
 * una con su propia acción de servidor (`agregarAction`/`quitarAction`,
 * ya cerradas sobre la sesión correcta). A diferencia de la foto de
 * perfil (RecortadorFoto dentro del form principal), acá cada subida o
 * borrado es INMEDIATO — se sube/quita apenas se confirma, no espera al
 * botón "Guardar" del resto del formulario. Evita tener que rastrear en
 * el form cuáles de hasta 6 fotos son nuevas.
 */
export function GaleriaFotosForm({
  fotosIniciales,
  agregarAction,
  quitarAction,
}: {
  fotosIniciales: string[];
  agregarAction: (formData: FormData) => Promise<ResultadoAccionGaleria>;
  quitarAction: (formData: FormData) => Promise<ResultadoAccionGaleria>;
}) {
  const [fotos, setFotos] = useState(fotosIniciales);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  // Fuerza que RecortadorFoto vuelva a "Sin foto todavía" después de cada
  // subida exitosa — la miniatura ya pasó a mostrarse en la grilla de abajo.
  const [claveRecortador, setClaveRecortador] = useState(0);

  function alRecortarNuevaFoto(blob: Blob) {
    setError(null);
    const archivo = new File([blob], "foto.webp", { type: "image/webp" });
    const formData = new FormData();
    formData.set("foto", archivo);
    startTransition(async () => {
      const resultado = await agregarAction(formData);
      if (resultado.ok) {
        setFotos(resultado.galeria);
        setClaveRecortador((k) => k + 1);
      } else {
        setError(resultado.error);
      }
    });
  }

  function quitarFoto(url: string) {
    setError(null);
    const formData = new FormData();
    formData.set("url", url);
    startTransition(async () => {
      const resultado = await quitarAction(formData);
      if (resultado.ok) setFotos(resultado.galeria);
      else setError(resultado.error);
    });
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}

      {fotos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {fotos.map((url) => (
            <div key={url} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Foto de la galería"
                className="aspect-[4/3] w-full rounded-input border border-border object-cover"
              />
              <button
                type="button"
                onClick={() => quitarFoto(url)}
                disabled={pendiente}
                className="absolute right-1 top-1 rounded-full bg-black/60 px-2 py-0.5 text-caption text-white disabled:opacity-50"
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      )}

      {fotos.length < MAX_FOTOS ? (
        <RecortadorFoto
          key={claveRecortador}
          etiqueta={`Agregar foto (${fotos.length}/${MAX_FOTOS})`}
          aspecto={4 / 3}
          onRecortada={alRecortarNuevaFoto}
        />
      ) : (
        <p className="text-caption text-text-faint">Ya tienes {MAX_FOTOS} fotos — quita una para agregar otra.</p>
      )}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Recortador de foto propio, sin librería — puerto a React del componente
 * Svelte equivalente de vitalud (`mi-ficha/[token]`,
 * `lib/components/miFicha/RecortadorFoto.svelte`): marco fijo, arrastrar
 * para reposicionar, slider de zoom, confirma convirtiendo a webp con
 * canvas.toBlob. Ver changelog punto 86 — mismo encuadre (cara en el
 * tercio superior) que ya usa el Directorio, para que la foto se vea igual
 * en ambos lados.
 */

const ANCHO_LIENZO = 300;

export function RecortadorFoto({
  etiqueta,
  aspecto = 3 / 4,
  fotoActualUrl = null,
  onRecortada,
  mostrarEjemplo = false,
  textoEjemplo = null,
}: {
  etiqueta: string;
  aspecto?: number;
  fotoActualUrl?: string | null;
  onRecortada: (blob: Blob) => void;
  mostrarEjemplo?: boolean;
  textoEjemplo?: string | null;
}) {
  const altoLienzo = Math.round(ANCHO_LIENZO / aspecto);

  const lienzoRef = useRef<HTMLCanvasElement | null>(null);
  const inputArchivoRef = useRef<HTMLInputElement | null>(null);
  const imagenRef = useRef<HTMLImageElement | null>(null);

  const [editando, setEditando] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [previsualizacion, setPrevisualizacion] = useState<string | null>(fotoActualUrl);
  const arrastrandoRef = useRef(false);
  const ultimoRef = useRef({ x: 0, y: 0 });

  function escalaBase() {
    const imagen = imagenRef.current;
    if (!imagen) return 1;
    return Math.max(ANCHO_LIENZO / imagen.width, altoLienzo / imagen.height);
  }

  function limitarOffset(actual: { x: number; y: number }) {
    const imagen = imagenRef.current;
    if (!imagen) return actual;
    const escala = escalaBase() * zoom;
    const anchoDibujo = imagen.width * escala;
    const altoDibujo = imagen.height * escala;
    const maxX = Math.max(0, (anchoDibujo - ANCHO_LIENZO) / 2);
    const maxY = Math.max(0, (altoDibujo - altoLienzo) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, actual.x)),
      y: Math.min(maxY, Math.max(-maxY, actual.y)),
    };
  }

  function dibujar() {
    const lienzo = lienzoRef.current;
    const imagen = imagenRef.current;
    if (!lienzo || !imagen) return;
    const ctx = lienzo.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, ANCHO_LIENZO, altoLienzo);
    const escala = escalaBase() * zoom;
    const anchoDibujo = imagen.width * escala;
    const altoDibujo = imagen.height * escala;
    const x = (ANCHO_LIENZO - anchoDibujo) / 2 + offset.x;
    const y = (altoLienzo - altoDibujo) / 2 + offset.y;
    ctx.drawImage(imagen, x, y, anchoDibujo, altoDibujo);
  }

  useEffect(() => {
    dibujar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, offset, editando]);

  function alCambiarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      imagenRef.current = img;
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setEditando(true);
      requestAnimationFrame(dibujar);
    };
    img.src = url;
  }

  function iniciarArrastre(e: React.PointerEvent<HTMLCanvasElement>) {
    arrastrandoRef.current = true;
    ultimoRef.current = { x: e.clientX, y: e.clientY };
  }

  function moverArrastre(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!arrastrandoRef.current) return;
    const dx = e.clientX - ultimoRef.current.x;
    const dy = e.clientY - ultimoRef.current.y;
    ultimoRef.current = { x: e.clientX, y: e.clientY };
    setOffset((actual) => limitarOffset({ x: actual.x + dx, y: actual.y + dy }));
  }

  function terminarArrastre() {
    arrastrandoRef.current = false;
  }

  function confirmar() {
    const lienzo = lienzoRef.current;
    if (!lienzo) return;
    lienzo.toBlob(
      (blob) => {
        if (!blob) return;
        setPrevisualizacion(URL.createObjectURL(blob));
        setEditando(false);
        onRecortada(blob);
      },
      "image/webp",
      0.85,
    );
  }

  function cancelar() {
    setEditando(false);
    imagenRef.current = null;
  }

  return (
    <div className="flex flex-col items-start gap-2.5">
      <p className="text-sm font-semibold text-text-primary">{etiqueta}</p>

      {editando ? (
        <>
          <div className="touch-none cursor-grab overflow-hidden rounded-input border border-border">
            <canvas
              ref={lienzoRef}
              width={ANCHO_LIENZO}
              height={altoLienzo}
              className="block h-auto max-w-full"
              onPointerDown={iniciarArrastre}
              onPointerMove={moverArrastre}
              onPointerUp={terminarArrastre}
              onPointerLeave={terminarArrastre}
            />
          </div>
          <label className="flex w-full max-w-[300px] flex-col gap-1 text-caption text-text-secondary">
            Acercar / alejar
            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              onChange={(e) => {
                const nuevoZoom = Number(e.target.value);
                setZoom(nuevoZoom);
                setOffset((actual) => limitarOffset(actual));
              }}
            />
          </label>
          <div className="flex gap-2.5">
            <Button type="button" variant="secondary" size="sm" onClick={cancelar}>
              Cancelar
            </Button>
            <Button type="button" size="sm" onClick={confirmar}>
              Usar esta foto
            </Button>
          </div>
        </>
      ) : (
        <>
          <div>
            {previsualizacion ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previsualizacion}
                alt="Foto de perfil"
                style={{ aspectRatio: aspecto }}
                className="w-[150px] rounded-input border border-border object-cover"
              />
            ) : mostrarEjemplo ? (
              <div
                style={{ aspectRatio: aspecto }}
                aria-hidden="true"
                className="w-[150px] overflow-hidden rounded-input border border-border"
              >
                <svg viewBox="0 0 150 200" preserveAspectRatio="xMidYMid slice" role="img" className="block h-full w-full">
                  <title>Encuadre de ejemplo: medio cuerpo, cara en el tercio superior</title>
                  <rect x="0" y="0" width="150" height="200" fill="var(--color-brand-primary-soft)" />
                  <line x1="0" y1="66.6" x2="150" y2="66.6" stroke="var(--color-brand-primary)" strokeWidth="1.5" strokeDasharray="4 5" opacity="0.55" />
                  <path d="M32,205 C32,148 42,116 75,111 C108,116 118,148 118,205 Z" fill="var(--color-brand-primary)" opacity="0.85" />
                  <circle cx="75" cy="58" r="27" fill="var(--color-brand-primary)" opacity="0.85" />
                  <rect x="0" y="150" width="150" height="50" fill="rgba(18, 32, 58, 0.55)" />
                </svg>
              </div>
            ) : (
              <div
                style={{ aspectRatio: aspecto }}
                className="flex w-[150px] items-center justify-center rounded-input border border-border bg-surface-muted p-2 text-center text-caption text-text-faint"
              >
                Sin foto todavía
              </div>
            )}
          </div>
          {!previsualizacion && mostrarEjemplo && textoEjemplo && (
            <p className="max-w-[220px] text-caption leading-snug text-text-faint">{textoEjemplo}</p>
          )}
          <Button type="button" variant="secondary" size="sm" onClick={() => inputArchivoRef.current?.click()}>
            {previsualizacion ? "Cambiar foto" : "Subir foto"}
          </Button>
          <input
            ref={inputArchivoRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={alCambiarArchivo}
          />
        </>
      )}
    </div>
  );
}

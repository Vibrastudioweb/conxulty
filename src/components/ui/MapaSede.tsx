"use client";

import { useId, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

// Los iconos default de Leaflet apuntan a rutas relativas que el bundler de
// Next no resuelve — en vez de pelear con la configuración de assets,
// cargamos los PNG del propio paquete (misma versión, sin API externa) por
// URL absoluta. Solo corre en el cliente (este archivo es "use client" y se
// monta vía next/dynamic sin SSR), así que tocar L.Icon acá es seguro.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Centro por defecto cuando no hay punto todavía: Venezuela, zoom amplio
// para que el médico ubique su ciudad y se acerque — no asumimos una ciudad.
const CENTRO_POR_DEFECTO: [number, number] = [8.0, -66.0];
const ZOOM_SIN_PUNTO = 6;
const ZOOM_CON_PUNTO = 16;

interface Punto {
  lat: number;
  lng: number;
}

function ManejadorClicks({ onClick }: { onClick: (p: Punto) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function Recentrador({ punto }: { punto: Punto }) {
  const mapa = useMap();
  mapa.flyTo([punto.lat, punto.lng], Math.max(mapa.getZoom(), ZOOM_CON_PUNTO), { duration: 0.6 });
  return null;
}

/**
 * Picker de ubicación exacta para UNA sede (changelog punto 80). Un médico
 * con varias sedes monta uno de estos por sede — cada uno es independiente,
 * con su propio estado y sus propios inputs ocultos `lat_<sedeId>` /
 * `lng_<sedeId>` que lee `actions.ts` al guardar. Gratis: OpenStreetMap
 * (tiles + geocodificación vía Nominatim), sin API key.
 */
export function MapaSede({
  sedeId,
  etiqueta,
  lat,
  lng,
}: {
  sedeId: string;
  etiqueta: string;
  lat: number | null;
  lng: number | null;
}) {
  const [punto, setPunto] = useState<Punto | null>(lat != null && lng != null ? { lat, lng } : null);
  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const inputId = useId();
  // Evita que un resultado de búsqueda que llega tarde (el médico ya tecleó
  // otra cosa) pise el punto equivocado.
  const busquedaVigente = useRef(0);

  async function buscarDireccion() {
    const consulta = busqueda.trim();
    if (!consulta) return;
    setBuscando(true);
    setErrorBusqueda(null);
    const idDeEstaBusqueda = ++busquedaVigente.current;
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "json");
      url.searchParams.set("q", consulta);
      // Sesgado a Venezuela (código de país ISO 3166-1 alpha-2) — las
      // direcciones que se buscan acá son siempre sedes venezolanas.
      url.searchParams.set("countrycodes", "ve");
      url.searchParams.set("limit", "1");
      const respuesta = await fetch(url.toString(), { headers: { Accept: "application/json" } });
      const resultados = (await respuesta.json()) as Array<{ lat: string; lon: string }>;
      if (idDeEstaBusqueda !== busquedaVigente.current) return;
      if (resultados.length === 0) {
        setErrorBusqueda("No se encontró esa dirección — prueba con menos detalle o marca el punto directo en el mapa.");
        return;
      }
      setPunto({ lat: parseFloat(resultados[0].lat), lng: parseFloat(resultados[0].lon) });
    } catch {
      if (idDeEstaBusqueda !== busquedaVigente.current) return;
      setErrorBusqueda("No se pudo buscar la dirección ahora — marca el punto directo en el mapa.");
    } finally {
      if (idDeEstaBusqueda === busquedaVigente.current) setBuscando(false);
    }
  }

  function usarUbicacionActual() {
    if (!navigator.geolocation) {
      setErrorBusqueda("Este navegador no puede compartir tu ubicación.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => setPunto({ lat: posicion.coords.latitude, lng: posicion.coords.longitude }),
      () => setErrorBusqueda("No se pudo obtener tu ubicación — marca el punto directo en el mapa."),
    );
  }

  return (
    <div className="space-y-2 rounded-card border border-border p-3">
      <p className="text-caption text-text-secondary">
        Ubicación exacta de <span className="font-medium text-text-primary">{etiqueta}</span> (opcional —
        ayuda a que te encuentren, pero la ciudad ya alcanza para publicarte).
      </p>

      <div className="flex gap-2">
        <label className="sr-only" htmlFor={inputId}>
          Buscar dirección en el mapa
        </label>
        <Input
          id={inputId}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void buscarDireccion();
            }
          }}
          placeholder="Buscar dirección o punto de referencia…"
        />
        <Button type="button" variant="secondary" loading={buscando} onClick={() => void buscarDireccion()}>
          Buscar
        </Button>
      </div>
      {errorBusqueda && <p className="text-caption text-danger-text">{errorBusqueda}</p>}

      <div className="h-64 overflow-hidden rounded-input border border-border">
        <MapContainer
          center={punto ? [punto.lat, punto.lng] : CENTRO_POR_DEFECTO}
          zoom={punto ? ZOOM_CON_PUNTO : ZOOM_SIN_PUNTO}
          scrollWheelZoom
          className="h-full w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ManejadorClicks onClick={setPunto} />
          {punto && <Recentrador punto={punto} />}
          {punto && (
            <Marker
              position={[punto.lat, punto.lng]}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const posicion = e.target.getLatLng();
                  setPunto({ lat: posicion.lat, lng: posicion.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-caption text-text-faint">
          {punto
            ? `Punto marcado: ${punto.lat.toFixed(5)}, ${punto.lng.toFixed(5)} — arrastrá el marcador para ajustar.`
            : "Sin punto marcado todavía — busca una dirección o toca el mapa."}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={usarUbicacionActual}>
            Usar mi ubicación
          </Button>
          {punto && (
            <Button type="button" variant="ghost" onClick={() => setPunto(null)}>
              Quitar punto
            </Button>
          )}
        </div>
      </div>

      <input type="hidden" name={`lat_${sedeId}`} value={punto?.lat ?? ""} />
      <input type="hidden" name={`lng_${sedeId}`} value={punto?.lng ?? ""} />
    </div>
  );
}

# Assets de marca — pendientes

Esta carpeta es el destino oficial para los assets de marca de CONXULTY
exportados desde Figma (https://cheer-polish-15026754.figma.site) cuando
estén disponibles:

- `isotipo.svg` — la "X" de dos cintas cruzadas en degradado azul→violeta
- `wordmark.svg` — logotipo horizontal completo
- `favicon.svg` / `favicon.ico` — versión para ícono de pestaña/app

Hasta entonces, el código usa sustitutos provisionales — nunca una
recreación del isotipo — encapsulados en tres archivos, que son los únicos
que deben actualizarse cuando el SVG oficial llegue:

- `src/components/brand/Wordmark.tsx` — wordmark tipográfico.
- `src/components/brand/BrandMark.tsx` — monograma "C" sobre el degradado,
  usado como isotipo provisional.
- `src/app/icon.svg` — favicon, mismo monograma en formato de ícono.

`src/components/brand/Logo.tsx` combina Wordmark + BrandMark y es el único
punto de la app del que el resto de las pantallas debería importar la
marca — así, sustituir estos tres archivos no implica tocar ninguna otra
pantalla.

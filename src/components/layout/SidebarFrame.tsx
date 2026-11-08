"use client";

import { useState } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

const CLAVE_STORAGE = "conxulty:sidebar-colapsado";

/** Lectura perezosa (solo en el inicializador de `useState`, nunca en un
 *  efecto) para no disparar un setState síncrono dentro de un efecto. En
 *  el render de servidor `window` no existe, así que ahí siempre vuelve
 *  `false` (expandido) — la hidratación puede corregirlo a `true` si había
 *  una preferencia guardada, con un posible parpadeo de un frame, pero sin
 *  el render en cascada que evita el linter. */
function leerPreferenciaInicial(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CLAVE_STORAGE) === "1";
  } catch {
    return false;
  }
}

/**
 * Envoltorio cliente del sidebar: controla el ancho (w-80 expandido / w-20
 * colapsado) y el botón para alternar — pedido del usuario (08-nov-2026):
 * "boton para retaraer sidebar y ampliar panel de trabajo". La preferencia
 * se guarda en localStorage para que sobreviva recargas; si localStorage no
 * está disponible (modo privado, por ejemplo), el toggle sigue funcionando
 * para la sesión en curso, solo que no se recuerda entre recargas.
 *
 * El contenido interno (`children`, ver `Sidebar.tsx`) sigue siendo Server
 * Component — se renderiza una sola vez y reacciona al colapso solo con
 * CSS, vía el atributo `data-collapsed` de este `<aside>` y selectores
 * `group-data-[collapsed=true]/sidebar:...` en los descendientes (así no
 * hace falta convertir toda la navegación a cliente solo para ocultar unas
 * etiquetas de texto). El ancho y el padding del propio `<aside>`, en
 * cambio, sí se controlan directo aquí (es el propio Client Component).
 */
export function SidebarFrame({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const [colapsado, setColapsado] = useState(leerPreferenciaInicial);

  function alternar() {
    setColapsado((actual) => {
      const nuevo = !actual;
      try {
        localStorage.setItem(CLAVE_STORAGE, nuevo ? "1" : "0");
      } catch {
        // El toggle en pantalla sigue funcionando aunque no se persista.
      }
      return nuevo;
    });
  }

  return (
    <aside
      data-collapsed={colapsado}
      className={`group/sidebar relative shrink-0 flex-col border-r border-border bg-surface py-8 transition-[width] duration-200 ${
        colapsado ? "w-20 px-3" : "w-80 px-6"
      } print:hidden ${className}`}
    >
      {children}

      <button
        type="button"
        onClick={alternar}
        aria-label={colapsado ? "Expandir menú" : "Retraer menú"}
        title={colapsado ? "Expandir menú" : "Retraer menú"}
        className="absolute -right-3 top-9 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-surface text-text-faint shadow-sm transition hover:border-brand-primary hover:text-brand-primary"
      >
        {colapsado ? (
          <PanelLeftOpen size={14} aria-hidden="true" />
        ) : (
          <PanelLeftClose size={14} aria-hidden="true" />
        )}
      </button>
    </aside>
  );
}

"use client";

import { useEffect, useRef } from "react";

/**
 * Respaldo local de lo que el médico va tecleando en un formulario
 * (13-nov-2026, segunda revisión del núcleo clínico).
 *
 * EL PROBLEMA: las acciones de guardar responden a cualquier fallo con un
 * redirect a `?error=…`, y la página se vuelve a dibujar con lo que hay en
 * la base. Todo lo tecleado desde el último guardado se perdía — una nota
 * clínica entera, o las cuatro líneas de una receta porque a una le
 * faltaban las indicaciones.
 *
 * QUÉ HACE: mientras se escribe, guarda los campos en sessionStorage. Si
 * la página vuelve con error (`restaurar`), los repone. Si vuelve sin
 * error, lo guardado en la base manda y el respaldo se descarta.
 *
 * sessionStorage y no localStorage, a propósito: es contenido clínico.
 * Vive solo en esa pestaña y muere al cerrarla; no queda en el equipo.
 *
 * Se coloca DENTRO del <form> que respalda.
 */
export function RespaldoFormulario({
  clave,
  restaurar,
}: {
  clave: string;
  restaurar: boolean;
}) {
  const marca = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const form = marca.current?.closest("form");
    if (!form) return;
    const llave = `respaldo:${clave}`;

    type Campo = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
    const campos = (): Campo[] =>
      Array.from(form.elements).filter((el): el is Campo => {
        if (
          !(el instanceof HTMLInputElement) &&
          !(el instanceof HTMLTextAreaElement) &&
          !(el instanceof HTMLSelectElement)
        ) {
          return false;
        }
        if (!el.name) return false;
        if (el instanceof HTMLInputElement && ["hidden", "file", "password", "submit"].includes(el.type)) {
          return false;
        }
        return true;
      });

    try {
      if (restaurar) {
        const crudo = sessionStorage.getItem(llave);
        if (crudo) {
          const valores = JSON.parse(crudo) as Record<string, string>;
          for (const campo of campos()) {
            if (campo.name in valores) campo.value = valores[campo.name];
          }
        }
      } else {
        sessionStorage.removeItem(llave);
      }
    } catch {
      // Sin almacenamiento (modo privado, cuota): el formulario funciona
      // igual, solo sin respaldo.
    }

    const guardar = () => {
      try {
        const valores: Record<string, string> = {};
        for (const campo of campos()) valores[campo.name] = campo.value;
        sessionStorage.setItem(llave, JSON.stringify(valores));
      } catch {
        // Ídem.
      }
    };

    form.addEventListener("input", guardar);
    return () => form.removeEventListener("input", guardar);
  }, [clave, restaurar]);

  return <span ref={marca} hidden />;
}

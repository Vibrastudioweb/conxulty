"use client";

import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useToast } from "@/components/feedback/toast/ToastProvider";
import { Button, type ButtonProps } from "@/components/ui/Button";

// Equivalente al botón "Descargar app" de conxulty.com (repo vitalud, para
// pacientes) — pedido puntual del usuario, 14-nov-2026: "en el login debe
// estar también". Otro origen (app.conxulty.com), mismo mecanismo PWA
// (manifest.ts + public/sw.js de este repo), capturado acá sin depender de
// un módulo compartido entre repos.
//
// Siempre visible, nunca condicionado a que 'beforeinstallprompt' ya haya
// disparado (lección de vitalud, PR #33: esa condición no es confiable).
// Sin el evento capturado, explica cómo instalar a mano en vez de no hacer
// nada.
export function BotonDescargarApp({
  variant = "ghost",
  size = "sm",
  className,
}: Pick<ButtonProps, "variant" | "size" | "className">) {
  const { toast } = useToast();
  const promptDiferidoRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [, forzarRender] = useState(0);

  useEffect(() => {
    const alAvisar = (evento: Event) => {
      evento.preventDefault();
      promptDiferidoRef.current = evento as BeforeInstallPromptEvent;
      forzarRender((n) => n + 1);
    };
    window.addEventListener("beforeinstallprompt", alAvisar);
    return () => window.removeEventListener("beforeinstallprompt", alAvisar);
  }, []);

  async function instalar() {
    const evento = promptDiferidoRef.current;
    if (!evento) {
      toast({
        tone: "info",
        title: "Instalar Conxulty OS",
        description:
          'Desde el menú (⋮) del navegador, elige "Instalar aplicación" o "Agregar a pantalla de inicio".',
      });
      return;
    }
    await evento.prompt();
    await evento.userChoice;
    promptDiferidoRef.current = null;
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      icon={<Download size={16} />}
      onClick={instalar}
      className={className}
    >
      Descargar app
    </Button>
  );
}

// No está en el DOM lib de TS por defecto.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

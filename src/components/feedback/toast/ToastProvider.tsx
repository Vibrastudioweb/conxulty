"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastTone = "success" | "warning" | "danger" | "info";

interface ToastInput {
  tone?: ToastTone;
  title: string;
  description?: string;
  /** ms antes de auto-descartarse; 0 = no se descarta solo. */
  durationMs?: number;
}

interface ToastRecord {
  id: string;
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastContextValue {
  toast: (input: ToastInput) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, typeof Info> = {
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: XCircle,
  info: Info,
};

const TONE_CLASSES: Record<ToastTone, string> = {
  success: "bg-success-soft text-success-text",
  warning: "bg-warning-soft text-warning-text",
  danger: "bg-danger-soft text-danger-text",
  info: "bg-info-soft text-info-text",
};

/**
 * Único proveedor de Toasts de la app. Es el mínimo Client Component
 * necesario para esto: envuelve `children` (que siguen siendo Server
 * Components sin cambios) y solo él mantiene estado en el cliente. No
 * introduce ninguna librería externa de notificaciones.
 *
 * Todavía no está conectado a ningún flujo existente (crear paciente,
 * guardar consulta, etc.) — esta fase solo deja la infraestructura lista;
 * esos formularios se migran de sus Alert inline a Toast en la fase de
 * rediseño de pantallas.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    ({ tone = "info", title, description, durationMs = 5000 }: ToastInput) => {
      const id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      setToasts((current) => [...current, { id, tone, title, description }]);

      if (durationMs > 0) {
        setTimeout(() => dismiss(id), durationMs);
      }
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-4 lg:items-end lg:px-6"
      >
        {toasts.map((item) => {
          const Icon = TONE_ICON[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-card border border-border bg-surface p-3 shadow-card ${TONE_CLASSES[item.tone]}`}
            >
              <Icon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-body-secondary font-semibold">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-caption opacity-90">
                    {item.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Cerrar notificación"
                className="shrink-0 opacity-70 transition hover:opacity-100"
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast debe usarse dentro de <ToastProvider>.");
  }
  return ctx;
}

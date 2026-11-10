import { MessageCircle } from "lucide-react";

/**
 * Acceso directo a soporte por WhatsApp desde el pie del sidebar
 * (09-nov-2026, punto 79 del changelog). Número fijo del equipo
 * (04227472852 → formato internacional 584227472852 para el enlace
 * wa.me, que no acepta el 0 inicial local).
 */
const WHATSAPP_SOPORTE = "584227472852";

export function SupportButton({ variant = "icon" }: { variant?: "icon" | "text" }) {
  if (variant === "text") {
    return (
      <a
        href={`https://wa.me/${WHATSAPP_SOPORTE}`}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-body-secondary text-text-secondary transition hover:text-text-primary"
      >
        Soporte
      </a>
    );
  }

  return (
    <a
      href={`https://wa.me/${WHATSAPP_SOPORTE}`}
      target="_blank"
      rel="noopener noreferrer"
      title="Soporte por WhatsApp"
      className="inline-flex items-center gap-1.5 text-caption text-text-faint transition hover:text-text-secondary"
    >
      <MessageCircle size={14} aria-hidden="true" />
      <span className="group-data-[collapsed=true]/sidebar:hidden">Soporte</span>
    </a>
  );
}

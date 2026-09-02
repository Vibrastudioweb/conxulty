import type { ComponentType, ReactNode } from "react";
import { Inbox } from "lucide-react";

export interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; className?: string }>;
  title?: string;
  /** Texto principal si no hay `title`, o descripción de apoyo si lo hay. */
  message: string;
  action?: ReactNode;
  /** Para usos dentro de listas densas donde el espaciado normal es excesivo. */
  compact?: boolean;
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  message,
  action,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center gap-2 text-center text-body-secondary text-text-secondary ${
        compact ? "py-4" : "py-8"
      }`}
    >
      <Icon size={compact ? 20 : 28} className="text-text-faint" />
      {title ? (
        <div>
          <p className="text-card-title font-medium text-text-primary">{title}</p>
          <p className="mt-0.5">{message}</p>
        </div>
      ) : (
        <p>{message}</p>
      )}
      {action}
    </div>
  );
}

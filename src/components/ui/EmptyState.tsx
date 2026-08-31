import type { ReactNode } from "react";

export function EmptyState({
  message,
  action,
}: {
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-sm text-text-secondary">
      <p>{message}</p>
      {action}
    </div>
  );
}

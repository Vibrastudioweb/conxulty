import type { ReactNode } from "react";
import { LogoutButton } from "./LogoutButton";

export function PageHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <h1 className="font-display text-lg font-semibold text-text-primary">
        {title}
      </h1>
      {action ?? <LogoutButton />}
    </div>
  );
}

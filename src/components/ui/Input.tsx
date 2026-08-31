import type { InputHTMLAttributes } from "react";

export function Input({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={[
        "w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-faint focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary disabled:bg-surface-muted disabled:text-text-secondary",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}

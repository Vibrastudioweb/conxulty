import type { ReactNode } from "react";

type AlertTone = "danger" | "success";

const TONE_CLASSES: Record<AlertTone, string> = {
  danger: "text-danger-text",
  success: "text-success-text",
};

export function Alert({
  tone,
  children,
}: {
  tone: AlertTone;
  children: ReactNode;
}) {
  return <p className={`text-sm ${TONE_CLASSES[tone]}`}>{children}</p>;
}

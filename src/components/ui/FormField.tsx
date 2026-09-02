import type { ReactNode } from "react";

interface FieldRenderProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

export interface FormFieldProps {
  /** Id explícito (no useId): FormField se usa desde Server Components,
   *  donde los hooks de React no están disponibles. */
  id: string;
  label: string;
  description?: string;
  error?: string;
  required?: boolean;
  children: (fieldProps: FieldRenderProps) => ReactNode;
}

/**
 * Centraliza label + input + descripción + error + los atributos ARIA que
 * los conectan, para que los formularios de pacientes/citas/consulta/
 * recetas puedan migrar a esto en la próxima fase sin reinventar el mismo
 * bloque en cada uno. No reemplaza todavía ningún formulario existente.
 */
export function FormField({
  id,
  label,
  description,
  error,
  required,
  children,
}: FormFieldProps) {
  const descriptionId = description ? `${id}-description` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [descriptionId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-body-secondary font-medium text-text-primary"
      >
        {label}
        {required && <span className="text-danger-text"> *</span>}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {description && !error && (
        <p id={descriptionId} className="text-caption text-text-secondary">
          {description}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-caption text-danger-text">
          {error}
        </p>
      )}
    </div>
  );
}

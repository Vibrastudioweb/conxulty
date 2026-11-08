import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";

/** Normaliza a formato internacional para `wa.me` (sin "+", sin espacios
 *  ni guiones). Los teléfonos del producto son venezolanos en formato
 *  local ("0414-1234567" — 11 dígitos empezando en 0); ese caso se
 *  convierte a "58414..." reemplazando el 0 inicial por el código de país.
 *  Un teléfono que ya venga en otro formato simplemente se limpia de
 *  símbolos, sin inventar un código de país que no se puede saber. */
function telefonoWhatsApp(telefono: string | null): string | null {
  if (!telefono) return null;
  const digitos = telefono.replace(/\D/g, "");
  if (digitos.length === 0) return null;
  if (digitos.startsWith("0") && digitos.length === 11) {
    return `58${digitos.slice(1)}`;
  }
  return digitos;
}

const CLASE_ACCESO =
  "inline-flex w-full items-center justify-center rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-secondary transition hover:border-brand-primary hover:text-brand-primary";

/**
 * Panel de "Accesos rápidos" en el Resumen de la ficha (ver changelog
 * punto 62: la demo lo mostraba y el usuario dijo que le parecía "súper
 * útil"). Solo lleva lo que NO está ya en la fila de acciones que vive
 * arriba de las pestañas (Iniciar/Continuar consulta, Recetar,
 * + Nueva cita, Archivar paciente — esas siguen ahí, visibles en
 * cualquier pestaña, no se duplican acá): Cobrar y Enviar WhatsApp.
 *
 * "Solicitar estudios" de la demo no está acá: no existe ningún modelo de
 * estudios/laboratorio en el producto — sería un producto nuevo, no un
 * botón (investigado en el punto 62).
 */
export function AccionesRapidasPaciente({
  pacienteId,
  telefono,
}: {
  pacienteId: string;
  telefono: string | null;
}) {
  const whatsapp = telefonoWhatsApp(telefono);

  return (
    <Card padding="cozy">
      <SectionLabel>Accesos rápidos</SectionLabel>
      <div className="mt-3 flex flex-col gap-2">
        <a href={`/caja?pacienteId=${pacienteId}`} className={CLASE_ACCESO}>
          Cobrar
        </a>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noopener noreferrer"
            className={CLASE_ACCESO}
          >
            Enviar WhatsApp
          </a>
        )}
      </div>
    </Card>
  );
}

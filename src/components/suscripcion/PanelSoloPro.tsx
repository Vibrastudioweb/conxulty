import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { precioFormateado } from "@/modules/suscripcion/precios";
import { NOMBRE_MODULO, type ModuloPro } from "@/modules/suscripcion/plan";

/**
 * Lo que ve, en vez del módulo, quien está en el plan Ficha (13-nov-2026,
 * hallazgo C2 de la auditoría). A propósito NO es una redirección:
 * rebotar al médico a Configuración cada vez que toca "Caja" es
 * desconcertante, y esta pantalla es además donde se explica qué trae Pro
 * y se llega al pago en un clic. El candado de verdad está en las server
 * actions (`requirePro`), que es lo que no se puede saltar desde el
 * navegador.
 */
const QUE_TRAE: Record<ModuloPro, string[]> = {
  consultas: [
    "Consultas con notas clínicas",
    "Antecedentes y odontograma del paciente",
    "Historial completo de cada atención",
  ],
  documentos: ["Recetas", "Informes y documentos con tu membrete"],
  caja: ["Apertura y cierre de caja", "Cobros por consulta", "Registro de gastos"],
  reportes: ["Ingresos del mes", "Consultas atendidas", "Comparación entre periodos"],
};

export function PanelSoloPro({ modulo }: { modulo: ModuloPro }) {
  return (
    // <main> igual que las páginas que reemplaza (/caja, /reportes,
    // /consultas): el shell del dashboard no envuelve el contenido en un
    // landmark, lo pone cada página.
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader
        title={NOMBRE_MODULO[modulo]}
        description="Esta parte del sistema viene con el plan Pro."
      />
      <div className="mt-6">
        <Card padding="spacious">
          <p className="text-body-secondary text-text-primary">
            Tu cuenta está en el plan Ficha. Con <strong>Pro</strong>, por{" "}
            {precioFormateado("PRO")} al mes, se activa:
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-body-secondary text-text-secondary">
            {QUE_TRAE[modulo].map((linea) => (
              <li key={linea}>{linea}</li>
            ))}
          </ul>
          <p className="mt-3 text-body-secondary text-text-secondary">
            Tus pacientes, tu agenda y tu ficha pública siguen funcionando igual.
          </p>
          <div className="mt-4">
            <Link href={`/ajustes?pro=${modulo}`}>
              <Button size="sm">Ver cómo pagar Pro</Button>
            </Link>
          </div>
        </Card>
      </div>
    </main>
  );
}

import Link from "next/link";
import { requireSesion } from "@/modules/core/autorizacion";
import { obtenerCajaAbierta } from "@/modules/cobros-caja/caja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  abrirCajaAction,
  cerrarCajaAction,
  registrarCobroConConsultaAction,
  registrarCobroRapidoAction,
  registrarGastoAction,
} from "./actions";

const CATEGORIAS_GASTO = ["ALQUILER", "INSUMOS", "PERSONAL", "SERVICIOS", "OTRO"] as const;

const MENSAJES_ERROR: Record<string, string> = {
  ya_abierta: "Ya hay una caja abierta para esta organización.",
  monto_invalido: "El monto no es válido.",
  caja_cerrada: "No hay una caja abierta para esta organización.",
  consulta_no_encontrada: "Esa consulta no existe o no pertenece a esta organización.",
  consulta_no_cerrada: "Solo se puede cobrar una consulta que está cerrada.",
  concepto_requerido: "El concepto es obligatorio cuando el cobro no tiene consulta.",
  monto_contado_requerido: "El monto contado es obligatorio para cerrar la caja.",
  sin_medico:
    "Esta organización no tiene un médico registrado todavía: no se puede registrar el cobro.",
};

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    abierta?: string;
    cobro?: string;
    gasto?: string;
    cierre?: string;
    esperado?: string;
    diferencia?: string;
  }>;
}) {
  const session = await requireSesion();
  const { error, abierta, cobro, gasto, cierre, esperado, diferencia } = await searchParams;

  const cajaAbierta = await obtenerCajaAbierta({
    organizacionId: session.user.organizacionId,
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader
        title="Caja"
        description={
          cajaAbierta
            ? `Abierta desde ${cajaAbierta.fechaApertura.toLocaleString("es")} · Monto inicial ${cajaAbierta.montoInicial.toString()}`
            : undefined
        }
        secondaryActions={
          <Link
            href="/reportes"
            className="rounded-button border border-border px-3 py-1.5 text-caption font-semibold text-text-secondary hover:border-brand-primary hover:text-brand-primary"
          >
            Ver reportes
          </Link>
        }
      />

      {abierta && (
        <div className="mt-4">
          <Alert tone="success">Caja abierta correctamente.</Alert>
        </div>
      )}

      {cobro && (
        <div className="mt-4">
          <Alert tone="success">Cobro registrado correctamente.</Alert>
        </div>
      )}

      {gasto && (
        <div className="mt-4">
          <Alert tone="success">Gasto registrado correctamente.</Alert>
        </div>
      )}

      {cierre && (
        <div className="mt-4">
          <Alert tone="success">
            Caja cerrada. Esperado: {esperado} — Diferencia: {diferencia}
          </Alert>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{MENSAJES_ERROR[error] ?? "Ocurrió un error."}</Alert>
        </div>
      )}

      {cajaAbierta ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <Card padding="compact" className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-text-primary">
              Registrar cobro con consulta
            </h2>
            <form action={registrarCobroConConsultaAction} className="mt-3 space-y-3">
              <div>
                <label htmlFor="consultaId" className="mb-1 block text-sm text-text-primary">
                  ID de la consulta (debe estar CERRADA)
                </label>
                <Input id="consultaId" name="consultaId" required />
              </div>
              <div>
                <label htmlFor="monto1" className="mb-1 block text-sm text-text-primary">
                  Monto
                </label>
                <Input id="monto1" name="monto" type="number" step="0.01" min="0.01" required />
              </div>
              <div>
                <label htmlFor="metodoPago1" className="mb-1 block text-sm text-text-primary">
                  Método de pago (opcional)
                </label>
                <Input id="metodoPago1" name="metodoPago" />
              </div>
              <div>
                <label htmlFor="concepto1" className="mb-1 block text-sm text-text-primary">
                  Concepto (opcional)
                </label>
                <Input id="concepto1" name="concepto" />
              </div>
              <Button type="submit" fullWidth variant="secondary">
                Registrar cobro
              </Button>
            </form>
          </Card>

          <Card padding="compact">
            <h2 className="text-sm font-semibold text-text-primary">
              Cobro rápido (sin consulta)
            </h2>
            <form action={registrarCobroRapidoAction} className="mt-3 space-y-3">
              <div>
                <label htmlFor="pacienteId" className="mb-1 block text-sm text-text-primary">
                  ID del paciente
                </label>
                <Input id="pacienteId" name="pacienteId" required />
              </div>
              <div>
                <label htmlFor="concepto2" className="mb-1 block text-sm text-text-primary">
                  Concepto (obligatorio)
                </label>
                <Input id="concepto2" name="concepto" required />
              </div>
              <div>
                <label htmlFor="monto2" className="mb-1 block text-sm text-text-primary">
                  Monto
                </label>
                <Input id="monto2" name="monto" type="number" step="0.01" min="0.01" required />
              </div>
              <div>
                <label htmlFor="metodoPago2" className="mb-1 block text-sm text-text-primary">
                  Método de pago (opcional)
                </label>
                <Input id="metodoPago2" name="metodoPago" />
              </div>
              <Button type="submit" fullWidth variant="secondary">
                Registrar cobro
              </Button>
            </form>
          </Card>

          <Card padding="compact">
            <h2 className="text-sm font-semibold text-text-primary">Registrar gasto</h2>
            <form action={registrarGastoAction} className="mt-3 space-y-3">
              <div>
                <label htmlFor="categoria" className="mb-1 block text-sm text-text-primary">
                  Categoría
                </label>
                <select
                  id="categoria"
                  name="categoria"
                  required
                  className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
                >
                  {CATEGORIAS_GASTO.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="monto3" className="mb-1 block text-sm text-text-primary">
                  Monto
                </label>
                <Input id="monto3" name="monto" type="number" step="0.01" min="0.01" required />
              </div>
              <div>
                <label htmlFor="nota" className="mb-1 block text-sm text-text-primary">
                  Nota (opcional)
                </label>
                <Input id="nota" name="nota" />
              </div>
              <Button type="submit" fullWidth variant="secondary">
                Registrar gasto
              </Button>
            </form>
          </Card>

          <Card padding="compact" className="ring-1 ring-danger">
            <h2 className="text-sm font-semibold text-danger-text">Cerrar caja</h2>
            <p className="mt-1 text-caption text-text-faint">
              Acción irreversible: cierra la caja del día y no puede reabrirse.
            </p>
            <form action={cerrarCajaAction} className="mt-3 space-y-3">
              <div>
                <label htmlFor="montoContado" className="mb-1 block text-sm text-text-primary">
                  Monto contado (efectivo real)
                </label>
                <Input
                  id="montoContado"
                  name="montoContado"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                />
              </div>
              <Button type="submit" fullWidth variant="destructive">
                Cerrar caja
              </Button>
            </form>
          </Card>
        </div>
      ) : (
        <form action={abrirCajaAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="montoInicial"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Monto inicial
            </label>
            <Input
              id="montoInicial"
              name="montoInicial"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              required
            />
          </div>
          <Button type="submit" fullWidth>
            Abrir caja
          </Button>
        </form>
      )}
    </main>
  );
}

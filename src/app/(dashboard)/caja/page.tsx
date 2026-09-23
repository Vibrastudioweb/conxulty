import { requireSesion } from "@/modules/core/autorizacion";
import { obtenerCajaAbierta } from "@/modules/cobros-caja/caja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import {
  abrirCajaAction,
  registrarCobroConConsultaAction,
  registrarCobroRapidoAction,
} from "./actions";

const MENSAJES_ERROR: Record<string, string> = {
  ya_abierta: "Ya hay una caja abierta para esta organización.",
  monto_invalido: "El monto no es válido.",
  caja_cerrada: "No hay una caja abierta para esta organización.",
  consulta_no_encontrada: "Esa consulta no existe o no pertenece a esta organización.",
  consulta_no_cerrada: "Solo se puede cobrar una consulta que está cerrada.",
  concepto_requerido: "El concepto es obligatorio cuando el cobro no tiene consulta.",
};

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; abierta?: string; cobro?: string }>;
}) {
  const session = await requireSesion();
  const { error, abierta, cobro } = await searchParams;

  const cajaAbierta = await obtenerCajaAbierta({
    organizacionId: session.user.organizacionId,
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6">
      <PageHeader title="Caja" />

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

      {error && (
        <div className="mt-4">
          <Alert tone="danger">{MENSAJES_ERROR[error] ?? "Ocurrió un error."}</Alert>
        </div>
      )}

      {cajaAbierta ? (
        <>
          <p className="mt-6 text-sm text-text-secondary">
            Caja abierta desde {cajaAbierta.fechaApertura.toLocaleString("es")} con
            monto inicial {cajaAbierta.montoInicial.toString()}.
          </p>

          <section className="mt-8 space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-text-primary">
              Registrar cobro con consulta
            </h2>
            <form action={registrarCobroConConsultaAction} className="space-y-3">
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
          </section>

          <section className="mt-8 space-y-3 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-text-primary">
              Cobro rápido (sin consulta)
            </h2>
            <form action={registrarCobroRapidoAction} className="space-y-3">
              <div>
                <label htmlFor="pacienteId" className="mb-1 block text-sm text-text-primary">
                  ID del paciente
                </label>
                <Input id="pacienteId" name="pacienteId" required />
              </div>
              <div>
                <label htmlFor="medicoId" className="mb-1 block text-sm text-text-primary">
                  ID del médico
                </label>
                <Input id="medicoId" name="medicoId" required />
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
          </section>
        </>
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

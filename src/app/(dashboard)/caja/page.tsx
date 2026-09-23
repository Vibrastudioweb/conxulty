import { requireSesion } from "@/modules/core/autorizacion";
import { obtenerCajaAbierta } from "@/modules/cobros-caja/caja";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { abrirCajaAction } from "./actions";

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; abierta?: string }>;
}) {
  const session = await requireSesion();
  const { error, abierta } = await searchParams;

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

      {error && (
        <div className="mt-4">
          <Alert tone="danger">
            {error === "ya_abierta"
              ? "Ya hay una caja abierta para esta organización."
              : "El monto inicial no es válido."}
          </Alert>
        </div>
      )}

      {cajaAbierta ? (
        <p className="mt-6 text-sm text-text-secondary">
          Caja abierta desde {cajaAbierta.fechaApertura.toLocaleString("es")} con
          monto inicial {cajaAbierta.montoInicial.toString()}.
        </p>
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

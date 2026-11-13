import Link from "next/link";
import { requireSesion } from "@/modules/core/autorizacion";
import { planDeOrganizacion, planIncluyeModulo } from "@/modules/suscripcion/plan";
import { PanelSoloPro } from "@/components/suscripcion/PanelSoloPro";
import { obtenerCajaAbierta, obtenerSaldoPorCuenta } from "@/modules/cobros-caja/caja";
import { METODOS_PAGO, INFO_METODO_PAGO } from "@/modules/cobros-caja/metodosPago";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import {
  abrirCajaAction,
  cerrarCajaAction,
  registrarCobroAction,
  registrarGastoAction,
} from "./actions";

const CATEGORIAS_GASTO = ["ALQUILER", "INSUMOS", "PERSONAL", "SERVICIOS", "OTRO"] as const;

function SelectMetodoPago({ id, name }: { id: string; name: string }) {
  return (
    <select
      id={id}
      name={name}
      required
      className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
    >
      {METODOS_PAGO.map((metodo) => (
        <option key={metodo} value={metodo}>
          {INFO_METODO_PAGO[metodo].label}
        </option>
      ))}
    </select>
  );
}

/**
 * Descuento/cortesía (ver changelog punto 13/48): colapsado por defecto
 * (`<details>`, sin JS de cliente, mismo patrón que NotificacionesBell) —
 * la mayoría de los cobros no lo necesitan. El motivo es obligatorio en el
 * servidor (`registrarCobro()`) cuando el monto es mayor a 0, no solo aquí.
 */
function CamposDescuento({ sufijo }: { sufijo: string }) {
  return (
    <details className="rounded-input border border-border px-3 py-2">
      <summary className="cursor-pointer text-sm text-text-secondary">
        + Agregar descuento o cortesía
      </summary>
      <div className="mt-3 space-y-3">
        <div>
          <label
            htmlFor={`descuentoMonto${sufijo}`}
            className="mb-1 block text-sm text-text-primary"
          >
            Monto del descuento
          </label>
          <Input
            id={`descuentoMonto${sufijo}`}
            name="descuentoMonto"
            type="number"
            step="0.01"
            min="0"
          />
        </div>
        <div>
          <label
            htmlFor={`descuentoMotivo${sufijo}`}
            className="mb-1 block text-sm text-text-primary"
          >
            Motivo (obligatorio si hay descuento)
          </label>
          <Input id={`descuentoMotivo${sufijo}`} name="descuentoMotivo" />
        </div>
      </div>
    </details>
  );
}

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
  descuento_motivo_requerido: "El motivo es obligatorio cuando hay un descuento o cortesía.",
};

export default async function CajaPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    abierta?: string;
    gasto?: string;
    cierre?: string;
    esperadoUsd?: string;
    esperadoBs?: string;
    diferenciaUsd?: string;
    diferenciaBs?: string;
    /** Prellena "Cobro rápido" desde el acceso "Cobrar" de la ficha del
     *  paciente (ver changelog punto 62) — no cambia el flujo, solo evita
     *  que el médico tenga que copiar/pegar el ID a mano. */
    pacienteId?: string;
  }>;
}) {
  const session = await requireSesion();
  if (!planIncluyeModulo(await planDeOrganizacion(session.user.organizacionId), "caja")) {
    return <PanelSoloPro modulo="caja" />;
  }
  const {
    error,
    abierta,
    gasto,
    cierre,
    esperadoUsd,
    esperadoBs,
    diferenciaUsd,
    diferenciaBs,
    pacienteId,
  } = await searchParams;

  const cajaAbierta = await obtenerCajaAbierta({
    organizacionId: session.user.organizacionId,
  });
  const saldoPorCuenta = await obtenerSaldoPorCuenta({
    organizacionId: session.user.organizacionId,
  });

  return (
    <main className="mx-auto min-h-screen max-w-md bg-background px-4 py-6 lg:max-w-4xl lg:px-10 lg:py-12">
      <PageHeader
        title="Caja"
        description={
          cajaAbierta
            ? `Abierta desde ${cajaAbierta.fechaApertura.toLocaleString("es")} · Monto inicial $${cajaAbierta.montoInicialUsd.toString()} / Bs ${cajaAbierta.montoInicialBs.toString()}`
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

      {gasto && (
        <div className="mt-4">
          <Alert tone="success">Gasto registrado correctamente.</Alert>
        </div>
      )}

      {cierre && (
        <div className="mt-4">
          <Alert tone="success">
            Caja cerrada. Esperado: ${esperadoUsd} / Bs {esperadoBs} — Diferencia: ${diferenciaUsd}{" "}
            / Bs {diferenciaBs}
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
            <h2 className="text-sm font-semibold text-text-primary">Registrar cobro</h2>
            <form action={registrarCobroAction} className="mt-3 space-y-3">
              {/* Selector de tipo (10-nov-2026: antes eran dos tarjetas
                  separadas — "aca no deberia haber dos cuadros de cobro uno
                  solo y seleccionar concepto"). Toggle con radios + CSS
                  puro (mismo criterio sin-JS que CamposDescuento con
                  <details>). Los dos radios, las etiquetas visuales y los
                  dos bloques de campos son TODOS hermanos directos de este
                  mismo div — `peer-checked/nombre` de Tailwind depende de
                  eso (selector de hermano general, no sirve si el radio
                  queda anidado dentro de su propia label). Esconder un
                  bloque con display:none alcanza para que el navegador deje
                  de exigirle su `required`: no hace falta deshabilitarlo. */}
              <div>
                <span className="mb-1 block text-sm text-text-primary">Tipo de cobro</span>
                <input
                  type="radio"
                  id="tipoConsulta"
                  name="tipo"
                  value="consulta"
                  defaultChecked
                  className="peer/consulta sr-only"
                />
                <input
                  type="radio"
                  id="tipoDirecto"
                  name="tipo"
                  value="directo"
                  className="peer/directo sr-only"
                />
                <div className="grid grid-cols-2 gap-2">
                  <label
                    htmlFor="tipoConsulta"
                    className="flex cursor-pointer items-center justify-center rounded-input border border-border px-3 py-2 text-center text-sm text-text-secondary transition peer-checked/consulta:border-brand-primary peer-checked/consulta:bg-brand-primary-soft peer-checked/consulta:font-medium peer-checked/consulta:text-brand-primary"
                  >
                    Con consulta
                  </label>
                  <label
                    htmlFor="tipoDirecto"
                    className="flex cursor-pointer items-center justify-center rounded-input border border-border px-3 py-2 text-center text-sm text-text-secondary transition peer-checked/directo:border-brand-primary peer-checked/directo:bg-brand-primary-soft peer-checked/directo:font-medium peer-checked/directo:text-brand-primary"
                  >
                    Cobro directo
                  </label>
                </div>

                {/* Campos de "con consulta" — visibles salvo que "directo" esté marcado. */}
                <div className="mt-3 space-y-3 peer-checked/directo:hidden">
                  <div>
                    <label htmlFor="consultaId" className="mb-1 block text-sm text-text-primary">
                      ID de la consulta (debe estar CERRADA)
                    </label>
                    <Input id="consultaId" name="consultaId" />
                  </div>
                  <div>
                    <label htmlFor="conceptoConsulta" className="mb-1 block text-sm text-text-primary">
                      Concepto (opcional)
                    </label>
                    <Input id="conceptoConsulta" name="conceptoConsulta" />
                  </div>
                </div>

                {/* Campos de "cobro directo" — ocultos salvo que "directo" esté marcado. */}
                <div className="mt-3 hidden space-y-3 peer-checked/directo:block">
                  <div>
                    <label htmlFor="pacienteId" className="mb-1 block text-sm text-text-primary">
                      ID del paciente
                    </label>
                    <Input id="pacienteId" name="pacienteId" defaultValue={pacienteId} />
                  </div>
                  <div>
                    <label htmlFor="conceptoDirecto" className="mb-1 block text-sm text-text-primary">
                      Concepto (obligatorio)
                    </label>
                    <Input id="conceptoDirecto" name="conceptoDirecto" />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="monto1" className="mb-1 block text-sm text-text-primary">
                  Monto (subtotal, antes de descuento)
                </label>
                <Input id="monto1" name="monto" type="number" step="0.01" min="0.01" required />
              </div>
              <div>
                <label htmlFor="metodoPago1" className="mb-1 block text-sm text-text-primary">
                  Método de pago
                </label>
                <SelectMetodoPago id="metodoPago1" name="metodoPago" />
              </div>
              <CamposDescuento sufijo="1" />
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
                <label htmlFor="metodoPago3" className="mb-1 block text-sm text-text-primary">
                  Pagado con
                </label>
                <SelectMetodoPago id="metodoPago3" name="metodoPago" />
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
              Acción irreversible: cierra la caja del día y no puede reabrirse. El arqueo solo
              cuenta efectivo físico — los cobros/gastos no efectivo no entran en el monto
              esperado.
            </p>
            <form action={cerrarCajaAction} className="mt-3 space-y-3">
              <div>
                <label
                  htmlFor="montoContadoUsd"
                  className="mb-1 block text-sm text-text-primary"
                >
                  Monto contado en USD (efectivo real)
                </label>
                <Input
                  id="montoContadoUsd"
                  name="montoContadoUsd"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="montoContadoBs"
                  className="mb-1 block text-sm text-text-primary"
                >
                  Monto contado en Bs (efectivo real)
                </label>
                <Input
                  id="montoContadoBs"
                  name="montoContadoBs"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue="0"
                  required
                />
              </div>
              <Button type="submit" fullWidth variant="destructive">
                Cerrar caja
              </Button>
            </form>
          </Card>

          <Card padding="compact" className="lg:col-span-2">
            <h2 className="text-sm font-semibold text-text-primary">Saldo en cuentas</h2>
            <p className="mt-1 text-caption text-text-faint">
              Monto inicial (solo efectivo) + cobros − gastos de hoy, por método. No es un
              acumulado histórico: cada caja nueva reinicia estos saldos.
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {saldoPorCuenta?.map((cuenta) => (
                <div
                  key={cuenta.metodoPago}
                  className="rounded-card border border-border bg-surface-muted p-3"
                >
                  <dt className="text-caption text-text-faint">{cuenta.label}</dt>
                  <dd className="mt-1 text-sm font-semibold text-text-primary">
                    {cuenta.moneda === "USD" ? "$" : "Bs "}
                    {Number(cuenta.saldo).toLocaleString("es", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      ) : (
        <form action={abrirCajaAction} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="montoInicialUsd"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Monto inicial en USD
            </label>
            <Input
              id="montoInicialUsd"
              name="montoInicialUsd"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0"
              required
            />
          </div>
          <div>
            <label
              htmlFor="montoInicialBs"
              className="mb-1 block text-sm font-medium text-text-primary"
            >
              Monto inicial en Bs
            </label>
            <Input
              id="montoInicialBs"
              name="montoInicialBs"
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

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import {
  activarSolicitudAction,
  cambiarEstadoSolicitudAction,
} from "./actions";

type Estado = "PENDIENTE" | "CONTACTADO" | "ACTIVADO" | "RECHAZADO";

export interface SolicitudVista {
  id: string;
  nombre: string;
  email: string;
  telefono: string;
  especialidad: string | null;
  nombreConsultorio: string;
  estado: Estado;
  createdAt: string;
}

interface Credencial {
  email: string;
  password: string;
  organizacion: string;
  rol: string;
  nombre: string;
  telefono: string;
}

const TONO: Record<Estado, BadgeTone> = {
  PENDIENTE: "warning",
  CONTACTADO: "info",
  ACTIVADO: "success",
  RECHAZADO: "neutral",
};

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mensajeWhatsApp(c: Credencial) {
  return [
    `Hola ${c.nombre}, ya activamos tu acceso a Conxulty.`,
    "",
    `Correo: ${c.email}`,
    `Contraseña temporal: ${c.password}`,
    "",
    "Entra y cámbiala cuando puedas. Cualquier duda, escríbeme por aquí.",
  ].join("\n");
}

function CopiarBoton({ texto, etiqueta }: { texto: string; etiqueta: string }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          /* sin permiso de portapapeles: el valor sigue visible para copiarlo a mano */
        }
      }}
    >
      {copiado ? "¡Copiado!" : etiqueta}
    </Button>
  );
}

function CredencialesPanel({
  credencial,
  onCerrar,
}: {
  credencial: Credencial;
  onCerrar: () => void;
}) {
  const digitos = credencial.telefono.replace(/\D/g, "");
  const waUrl = `https://wa.me/${digitos}?text=${encodeURIComponent(mensajeWhatsApp(credencial))}`;

  return (
    <Card padding="spacious" highlighted className="space-y-3">
      <Alert tone="success" title={`Cuenta creada — ${credencial.organizacion}`}>
        Copia estos datos ahora: la contraseña no se vuelve a mostrar ni se
        guarda en claro. Envíaselos al médico por WhatsApp.
      </Alert>

      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-caption text-text-secondary">Correo</dt>
          <dd className="font-mono text-sm break-all">{credencial.email}</dd>
          <div className="mt-1">
            <CopiarBoton texto={credencial.email} etiqueta="Copiar correo" />
          </div>
        </div>
        <div>
          <dt className="text-caption text-text-secondary">
            Contraseña temporal ({credencial.rol})
          </dt>
          <dd className="font-mono text-sm break-all select-all">
            {credencial.password}
          </dd>
          <div className="mt-1">
            <CopiarBoton texto={credencial.password} etiqueta="Copiar contraseña" />
          </div>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        <CopiarBoton
          texto={mensajeWhatsApp(credencial)}
          etiqueta="Copiar mensaje completo"
        />
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center rounded-button border border-brand-primary px-3 py-1.5 text-caption font-semibold text-brand-primary hover:bg-brand-primary-soft"
        >
          Abrir WhatsApp con el mensaje
        </a>
        <Button type="button" size="sm" variant="ghost" onClick={onCerrar}>
          Ya los copié, ocultar
        </Button>
      </div>
    </Card>
  );
}

function ActivarForm({
  solicitud,
  organizaciones,
  onActivada,
}: {
  solicitud: SolicitudVista;
  organizaciones: { id: string; nombre: string }[];
  onActivada: (c: Credencial) => void;
}) {
  const [modo, setModo] = useState<"nueva" | "existente">("nueva");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(formData: FormData) {
    setError(null);
    iniciar(async () => {
      const resultado = await activarSolicitudAction({
        solicitudId: solicitud.id,
        modoOrganizacion: modo,
        organizacionId: String(formData.get("organizacionId") ?? "") || undefined,
        nombreOrganizacion: String(formData.get("nombreOrganizacion") ?? ""),
        adminNombre: String(formData.get("adminNombre") ?? ""),
        adminEmail: String(formData.get("adminEmail") ?? ""),
        rol: String(formData.get("rol") ?? "ADMIN"),
      });
      if (resultado.ok) {
        onActivada({
          ...resultado.credenciales,
          nombre: String(formData.get("adminNombre") ?? solicitud.nombre),
          telefono: solicitud.telefono,
        });
      } else {
        setError(resultado.error);
      }
    });
  }

  const etiqueta = "mb-1 block text-sm font-medium text-text-primary";

  return (
    <form action={enviar} className="mt-4 space-y-4 border-t border-border pt-4">
      <fieldset className="space-y-2">
        <legend className={etiqueta}>Organización</legend>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="modo"
            checked={modo === "nueva"}
            onChange={() => setModo("nueva")}
          />
          Crear una nueva
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            name="modo"
            checked={modo === "existente"}
            onChange={() => setModo("existente")}
            disabled={organizaciones.length === 0}
          />
          Usar una existente
        </label>
      </fieldset>

      {modo === "nueva" ? (
        <div>
          <label htmlFor={`org-${solicitud.id}`} className={etiqueta}>
            Nombre de la organización
          </label>
          <Input
            id={`org-${solicitud.id}`}
            name="nombreOrganizacion"
            defaultValue={solicitud.nombreConsultorio}
            required
          />
        </div>
      ) : (
        <div>
          <label htmlFor={`orgsel-${solicitud.id}`} className={etiqueta}>
            Organización existente
          </label>
          <select
            id={`orgsel-${solicitud.id}`}
            name="organizacionId"
            required
            className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm"
            defaultValue=""
          >
            <option value="" disabled>
              Elige una…
            </option>
            {organizaciones.map((o) => (
              <option key={o.id} value={o.id}>
                {o.nombre}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor={`nom-${solicitud.id}`} className={etiqueta}>
            Nombre del usuario
          </label>
          <Input
            id={`nom-${solicitud.id}`}
            name="adminNombre"
            defaultValue={solicitud.nombre}
            required
          />
        </div>
        <div>
          <label htmlFor={`mail-${solicitud.id}`} className={etiqueta}>
            Correo de acceso
          </label>
          <Input
            id={`mail-${solicitud.id}`}
            name="adminEmail"
            type="email"
            defaultValue={solicitud.email}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor={`rol-${solicitud.id}`} className={etiqueta}>
          Rol de la cuenta
        </label>
        <select
          id={`rol-${solicitud.id}`}
          name="rol"
          className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm"
          defaultValue="ADMIN"
        >
          <option value="ADMIN">ADMIN de la organización (por defecto)</option>
          <option value="MEDICO">
            MEDICO (crea también su perfil médico para usar agenda y consultas)
          </option>
        </select>
      </div>

      {error && <Alert tone="danger">{error}</Alert>}

      <Button type="submit" loading={pendiente}>
        Crear cuenta y generar contraseña
      </Button>
    </form>
  );
}

export function PanelSolicitudes({
  solicitudes,
  organizaciones,
}: {
  solicitudes: SolicitudVista[];
  organizaciones: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [credenciales, setCredenciales] = useState<Credencial[]>([]);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function cambiarEstado(id: string, estado: "CONTACTADO" | "RECHAZADO") {
    setMensaje(null);
    iniciar(async () => {
      const r = await cambiarEstadoSolicitudAction(id, estado);
      if (!r.ok) setMensaje(r.error ?? "No se pudo actualizar.");
      router.refresh();
    });
  }

  const abiertas = solicitudes.filter(
    (s) => s.estado === "PENDIENTE" || s.estado === "CONTACTADO",
  ).length;

  return (
    <div className="space-y-4">
      {credenciales.map((c, i) => (
        <CredencialesPanel
          key={`${c.email}-${i}`}
          credencial={c}
          onCerrar={() =>
            setCredenciales((prev) => prev.filter((_, j) => j !== i))
          }
        />
      ))}

      {mensaje && <Alert tone="danger">{mensaje}</Alert>}

      <p className="text-sm text-text-secondary">
        {solicitudes.length === 0
          ? "Todavía no hay solicitudes."
          : `${abiertas} abierta${abiertas === 1 ? "" : "s"} de ${solicitudes.length} en total.`}
      </p>

      <ul className="space-y-3">
        {solicitudes.map((s) => {
          const esAbierta = s.estado === "PENDIENTE" || s.estado === "CONTACTADO";
          return (
            <li key={s.id}>
              <Card padding="spacious">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-text-primary">{s.nombre}</p>
                    <p className="text-sm text-text-secondary">
                      {s.nombreConsultorio}
                      {s.especialidad ? ` · ${s.especialidad}` : ""}
                    </p>
                  </div>
                  <Badge tone={TONO[s.estado]}>{s.estado}</Badge>
                </div>

                <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-caption text-text-secondary">Correo</dt>
                    <dd className="break-all">{s.email}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-secondary">Teléfono</dt>
                    <dd>{s.telefono}</dd>
                  </div>
                  <div>
                    <dt className="text-caption text-text-secondary">Recibida</dt>
                    <dd>{fecha(s.createdAt)}</dd>
                  </div>
                </dl>

                {esAbierta && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => setAbierta(abierta === s.id ? null : s.id)}
                    >
                      {abierta === s.id ? "Cerrar" : "Activar"}
                    </Button>
                    {s.estado === "PENDIENTE" && (
                      <Button
                        type="button"
                        variant="secondary"
                        loading={pendiente}
                        onClick={() => cambiarEstado(s.id, "CONTACTADO")}
                      >
                        Marcar como contactado
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="destructive"
                      loading={pendiente}
                      onClick={() => {
                        if (
                          window.confirm(
                            `¿Rechazar la solicitud de ${s.nombre}? No se creará ninguna cuenta.`,
                          )
                        ) {
                          cambiarEstado(s.id, "RECHAZADO");
                        }
                      }}
                    >
                      Rechazar
                    </Button>
                  </div>
                )}

                {esAbierta && abierta === s.id && (
                  <ActivarForm
                    solicitud={s}
                    organizaciones={organizaciones}
                    onActivada={(c) => {
                      setCredenciales((prev) => [c, ...prev]);
                      setAbierta(null);
                      router.refresh();
                    }}
                  />
                )}
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

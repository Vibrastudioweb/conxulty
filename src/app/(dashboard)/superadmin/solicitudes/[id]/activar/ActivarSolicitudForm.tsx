"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  activarSolicitudAction,
  type ActivarResultado,
} from "../../../actions";

const LABEL = "mb-1 block text-sm font-medium text-text-primary";

export function ActivarSolicitudForm({
  solicitudId,
  nombreSugerido,
  emailSugerido,
  organizacionSugerida,
  organizaciones,
  activable,
}: {
  solicitudId: string;
  nombreSugerido: string;
  emailSugerido: string;
  organizacionSugerida: string;
  organizaciones: { id: string; nombre: string }[];
  activable: boolean;
}) {
  const [resultado, accion, pendiente] = useActionState<ActivarResultado, FormData>(
    activarSolicitudAction,
    null,
  );

  if (resultado?.ok) {
    return (
      <div className="space-y-4">
        <Alert tone="success" title="Cuenta creada">
          Organización: {resultado.organizacion}. Copia estas credenciales
          ahora: la contraseña no se vuelve a mostrar ni queda guardada.
        </Alert>
        <dl className="space-y-3 rounded-card border border-border bg-surface p-4 text-sm">
          <div>
            <dt className="text-caption text-text-secondary">Correo</dt>
            <dd className="select-all font-mono text-text-primary">{resultado.email}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-secondary">Contraseña temporal</dt>
            <dd className="select-all font-mono text-text-primary">{resultado.password}</dd>
          </div>
        </dl>
      </div>
    );
  }

  if (!activable) {
    return <Alert tone="warning">Esta solicitud ya fue procesada.</Alert>;
  }

  return (
    <form action={accion} className="space-y-4">
      <input type="hidden" name="solicitudId" value={solicitudId} />

      <div>
        <label htmlFor="organizacionId" className={LABEL}>
          Organización
        </label>
        <select
          id="organizacionId"
          name="organizacionId"
          defaultValue=""
          className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="">Crear organización nueva</option>
          {organizaciones.map((o) => (
            <option key={o.id} value={o.id}>
              Usar existente: {o.nombre}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="nombreOrganizacion" className={LABEL}>
          Nombre de la organización nueva
        </label>
        <Input
          id="nombreOrganizacion"
          name="nombreOrganizacion"
          defaultValue={organizacionSugerida}
          required
          maxLength={160}
        />
        <p className="mt-1 text-caption text-text-secondary">
          Se ignora si eliges una organización existente.
        </p>
      </div>

      <div>
        <label htmlFor="nombreUsuario" className={LABEL}>
          Nombre del usuario
        </label>
        <Input id="nombreUsuario" name="nombreUsuario" defaultValue={nombreSugerido} required maxLength={120} />
      </div>

      <div>
        <label htmlFor="email" className={LABEL}>
          Correo (usuario de acceso)
        </label>
        <Input id="email" name="email" type="email" defaultValue={emailSugerido} required maxLength={160} />
      </div>

      <div>
        <label htmlFor="rol" className={LABEL}>
          Rol
        </label>
        {/* 13-nov-2026 (auditoría Bloque 3): este menú venía con ADMIN por
            defecto. Activar a un médico sin tocarlo le creaba una cuenta
            SIN perfil de médico —sin agenda, sin pacientes, sin ficha
            pública— y eso no se arregla desde el producto: hay que entrar
            a la base a cambiarle el rol y crearle el perfil a mano.
            Quien pide acceso a Conxulty es un médico; ese es el valor por
            defecto, y la otra opción dice qué se pierde al elegirla. */}
        <select
          id="rol"
          name="rol"
          defaultValue="MEDICO"
          className="w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
        >
          <option value="MEDICO">Médico — agenda, pacientes, consultas y ficha pública</option>
          <option value="ADMIN">Administrativo — solo caja y reportes, sin agenda ni ficha</option>
        </select>
        <p className="mt-1 text-body-secondary text-text-secondary">
          Casi siempre es Médico. Administrativo no tiene perfil médico y no se
          puede convertir después desde el producto.
        </p>
      </div>

      {resultado && !resultado.ok && <Alert tone="danger">{resultado.error}</Alert>}

      <Button type="submit" loading={pendiente}>
        Crear cuenta y generar contraseña
      </Button>
    </form>
  );
}

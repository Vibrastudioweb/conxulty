import { Input } from "@/components/ui/Input";

const OPCIONES_SEXO = ["Femenino", "Masculino", "Otro"];

const CLASE_SELECT =
  "w-full rounded-input border border-border bg-surface px-3 py-2 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary";

export interface ValoresPacienteForm {
  nombre?: string;
  apellido?: string;
  fechaNacimiento?: string;
  sexo?: string;
  telefono?: string;
  email?: string;
  documentoIdentidad?: string;
  direccion?: string;
  contactoEmergenciaNombre?: string;
  contactoEmergenciaTelefono?: string;
}

/**
 * Campos del formulario de Paciente, compartidos entre creación
 * (/pacientes/nuevo) y edición (/pacientes/[id]/editar) para no duplicar
 * los mismos 9 campos dos veces. No incluye el <form>/botón de envío: cada
 * página decide su propia action y layout alrededor.
 */
export function PacienteFormFields({ valores = {} }: { valores?: ValoresPacienteForm }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="nombre" className="mb-1 block text-sm font-medium text-text-primary">
            Nombre
          </label>
          <Input id="nombre" name="nombre" defaultValue={valores.nombre} required />
        </div>
        <div>
          <label htmlFor="apellido" className="mb-1 block text-sm font-medium text-text-primary">
            Apellido
          </label>
          <Input id="apellido" name="apellido" defaultValue={valores.apellido} required />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="fechaNacimiento" className="mb-1 block text-sm font-medium text-text-primary">
            Fecha de nacimiento
          </label>
          <Input
            id="fechaNacimiento"
            name="fechaNacimiento"
            type="date"
            defaultValue={valores.fechaNacimiento}
          />
        </div>
        <div>
          <label htmlFor="sexo" className="mb-1 block text-sm font-medium text-text-primary">
            Sexo
          </label>
          <select
            id="sexo"
            name="sexo"
            defaultValue={valores.sexo ?? ""}
            className={CLASE_SELECT}
          >
            <option value="">Sin especificar</option>
            {OPCIONES_SEXO.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="documentoIdentidad" className="mb-1 block text-sm font-medium text-text-primary">
          Documento de identidad
        </label>
        <Input
          id="documentoIdentidad"
          name="documentoIdentidad"
          defaultValue={valores.documentoIdentidad}
          placeholder="Cédula, DNI o pasaporte"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="telefono" className="mb-1 block text-sm font-medium text-text-primary">
            Teléfono
          </label>
          <Input id="telefono" name="telefono" type="tel" defaultValue={valores.telefono} />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
            Email
          </label>
          <Input id="email" name="email" type="email" defaultValue={valores.email} />
        </div>
      </div>

      <div>
        <label htmlFor="direccion" className="mb-1 block text-sm font-medium text-text-primary">
          Dirección
        </label>
        <Input id="direccion" name="direccion" defaultValue={valores.direccion} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="contactoEmergenciaNombre"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            Contacto de emergencia
          </label>
          <Input
            id="contactoEmergenciaNombre"
            name="contactoEmergenciaNombre"
            defaultValue={valores.contactoEmergenciaNombre}
            placeholder="Nombre"
          />
        </div>
        <div>
          <label
            htmlFor="contactoEmergenciaTelefono"
            className="mb-1 block text-sm font-medium text-text-primary"
          >
            &nbsp;
          </label>
          <Input
            id="contactoEmergenciaTelefono"
            name="contactoEmergenciaTelefono"
            type="tel"
            defaultValue={valores.contactoEmergenciaTelefono}
            placeholder="Teléfono"
          />
        </div>
      </div>
    </div>
  );
}

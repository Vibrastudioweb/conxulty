/**
 * Modelo conceptual de comunicación con pacientes. WhatsApp es el primer canal,
 * pero el módulo no lo asume como único: Conversacion/Mensaje son agnósticos
 * de canal, y el canal concreto vive detrás de un adaptador en
 * src/integrations/whatsapp-provider.
 *
 * Fase 0: solo se definen los tipos/arquitectura. La persistencia real
 * (tablas Prisma) y la integración con el proveedor llegan en fases
 * posteriores, cuando se implemente el canal real.
 */

export type CanalConversacion = "whatsapp";

export type EstadoConversacion =
  | "abierta"
  | "en_espera_medico"
  | "cerrada";

export type OrigenMensaje = "paciente" | "medico" | "ia";

export interface Mensaje {
  id: string;
  conversacionId: string;
  origen: OrigenMensaje;
  contenido: string;
  sugeridoPorIA: boolean;
  aprobadoPorMedico: boolean;
  fecha: Date;
}

export interface Conversacion {
  id: string;
  organizacionId: string;
  pacienteId: string | null;
  canal: CanalConversacion;
  estado: EstadoConversacion;
  citaId: string | null;
  mensajes: Mensaje[];
}

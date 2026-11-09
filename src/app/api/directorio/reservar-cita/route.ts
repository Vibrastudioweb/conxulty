// Endpoint de reserva pública (Task #15, changelog punto 91/97) —
// hermano inverso de /api/sincronizar-profesional del lado de vitalud:
// ESTE endpoint es llamado POR vitalud (la ficha pública en
// conxulty.com), no al revés. Primera vez que el tráfico cruza en esta
// dirección (hasta ahora conxulty siempre llamaba a vitalud, nunca al
// contrario).
//
// Autenticación: mismo secreto compartido servidor-a-servidor
// (CONXULTY_SYNC_SECRET, header x-conxulty-secret) que ya usa
// sincronizacion.ts para llamar a vitalud — mismo criterio exacto que
// el endpoint de vitalud: comparación de tiempo constante, nunca una
// sesión de persona (no hay humano autenticado al otro lado, es el
// servidor de vitalud reenviando lo que un visitante anónimo mandó).
//
// Alcance deliberadamente NO cubierto en esta primera versión:
//  - Sin aviso automático al paciente cuando el médico confirma/rechaza
//    — no hay WhatsApp Business API ni email en este flujo, el único
//    canal hoy es que el consultorio llame/escriba al teléfono que dejó
//    (mismo límite que ya tenía "Agendar cita" antes de esta tarea).
//  - Sin vista previa de horarios ya ocupados en la ficha pública — el
//    conflicto se detecta recién al reservar (hayConflictoHorario), no
//    se filtran de antemano los cupos ya tomados. Construir esa vista
//    previa es una pieza aparte (requiere un GET de disponibilidad).

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import {
  crearCitaPublicaPorFicha,
  FichaNoEncontradaError,
  FichaSinMedicoError,
} from "@/modules/core/citasPublicas";
import { CitaConflictoHorarioError } from "@/modules/core/citas";
import { PacienteArchivadoError } from "@/modules/core/pacientes";

export const dynamic = "force-dynamic";

function noAutorizado() {
  return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
}

function verificarSecreto(request: Request): boolean {
  const secreto = process.env.CONXULTY_SYNC_SECRET;
  if (!secreto) return false;
  const recibido = request.headers.get("x-conxulty-secret");
  if (!recibido) return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(secreto);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const cuerpoSchema = z.object({
  fichaDirectorioId: z.string().min(1),
  nombrePaciente: z.string().trim().min(1).max(200),
  telefonoPaciente: z.string().trim().min(5).max(40),
  fechaHoraIso: z.string().min(1),
  motivo: z.string().trim().max(500).optional().nullable(),
});

export async function POST(request: Request) {
  if (!verificarSecreto(request)) return noAutorizado();

  const cuerpo = await request.json().catch(() => null);
  const parseo = cuerpoSchema.safeParse(cuerpo);
  if (!parseo.success) {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }

  const fechaHora = new Date(parseo.data.fechaHoraIso);
  if (Number.isNaN(fechaHora.getTime())) {
    return NextResponse.json({ ok: false, error: "Fecha/hora inválida." }, { status: 400 });
  }
  if (fechaHora.getTime() < Date.now()) {
    return NextResponse.json({ ok: false, error: "Esa fecha/hora ya pasó." }, { status: 400 });
  }

  try {
    const resultado = await crearCitaPublicaPorFicha({
      fichaDirectorioId: parseo.data.fichaDirectorioId,
      nombrePaciente: parseo.data.nombrePaciente,
      telefonoPaciente: parseo.data.telefonoPaciente,
      fechaHora,
      motivo: parseo.data.motivo,
    });
    return NextResponse.json({ ok: true, citaId: resultado.citaId, tokenResena: resultado.tokenResena });
  } catch (err) {
    if (err instanceof FichaNoEncontradaError || err instanceof FichaSinMedicoError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    }
    if (err instanceof CitaConflictoHorarioError) {
      return NextResponse.json(
        { ok: false, error: "Ese horario ya no está disponible — elige otro." },
        { status: 409 },
      );
    }
    if (err instanceof PacienteArchivadoError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 409 });
    }
    console.error("Error reservando cita pública:", err);
    return NextResponse.json({ ok: false, error: "Error interno al reservar." }, { status: 500 });
  }
}

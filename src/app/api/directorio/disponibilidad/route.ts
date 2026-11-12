// Disponibilidad de una ficha para la reserva pública (12-nov-2026,
// auditoría del flujo Directorio → cita → OS). Lo llama vitalud antes de
// mostrar el formulario "Reserva tu cita":
//
//  - `conectada: false` → esa ficha no tiene un médico del OS detrás; la
//    ficha pública ofrece WhatsApp en vez de un formulario que iba a
//    fallar al final.
//  - `ocupados` → intervalos ya tomados, para no ofrecer horarios que la
//    reserva rechazaría.
//
// Misma autenticación que /api/directorio/reservar-cita: secreto
// compartido servidor-a-servidor, comparación de tiempo constante. Solo
// devuelve inicio y fin de cada intervalo — ningún dato de pacientes.

import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { disponibilidadPorFicha } from "@/modules/core/citasPublicas";

export const dynamic = "force-dynamic";

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

const cuerpoSchema = z.object({ fichaDirectorioId: z.string().trim().min(1).max(100) });

export async function POST(request: Request) {
  if (!verificarSecreto(request)) {
    return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Cuerpo inválido." }, { status: 400 });
  }
  const parseo = cuerpoSchema.safeParse(cuerpo);
  if (!parseo.success) {
    return NextResponse.json({ ok: false, error: "Datos inválidos." }, { status: 400 });
  }

  try {
    const disponibilidad = await disponibilidadPorFicha(parseo.data.fichaDirectorioId);
    return NextResponse.json({ ok: true, ...disponibilidad });
  } catch (err) {
    console.error("[directorio/disponibilidad]", err);
    return NextResponse.json({ ok: false, error: "No se pudo consultar la agenda." }, { status: 500 });
  }
}

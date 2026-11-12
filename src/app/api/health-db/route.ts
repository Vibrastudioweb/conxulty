import { NextResponse } from "next/server";
import { prisma } from "@/db/client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    // `zona` permite comprobar desde afuera que el servidor quedó en hora
    // de Venezuela (ver src/instrumentation.ts): si acá no dice
    // America/Caracas, las horas de las citas se están mostrando corridas.
    return NextResponse.json({
      ok: true,
      zona: Intl.DateTimeFormat().resolvedOptions().timeZone,
      desfaseMinutos: new Date().getTimezoneOffset(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

// Seed de demostración para que /hoy (y Agenda/Caja) se vean "llenos" como
// la demo navegable, en la cuenta del odontólogo de prueba creada por
// seed-plantillas-demo.mjs — ver changelog punto 55. Agrega pacientes,
// citas (hoy, ayer y el resto del mes, para que el gráfico "Actividad del
// mes" y los deltas "vs. ayer" tengan datos reales que mostrar) y cobros
// (hoy y ayer).
//
// Idempotente por diseño (mismo criterio que seed.mjs/seed-plantillas-demo):
// todo usa `upsert` con IDs fijos, así que correrlo varias veces no duplica
// nada — las citas/cobros de "hoy" y "ayer" se RE-FECHAN cada vez que se
// corre, para que el seed siga sirviendo aunque haya pasado más de un día
// desde la última vez.
//
// Ejecutar con: node prisma/seed-hoy-demo.mjs
// (VPN desactivada, igual que para `npx prisma db push`.)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const supabaseCa = fs.readFileSync(
  path.join(process.cwd(), "prisma", "certs", "supabase-ca.crt"),
  "utf8",
);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: { ca: supabaseCa, rejectUnauthorized: true },
});
const prisma = new PrismaClient({ adapter });

const EMAIL = "odontologo@conxulty.local";
const PASSWORD = "Conxulty123!";
const ORG_ID = "org-demo-odontologo";

// Pacientes de prueba — nombres venezolanos comunes, nada real.
const PACIENTES = [
  { id: "paciente-demo-odonto-01", nombre: "José", apellido: "Rondón", telefono: "0414-1234501" },
  { id: "paciente-demo-odonto-02", nombre: "María", apellido: "Pérez", telefono: "0414-1234502" },
  { id: "paciente-demo-odonto-03", nombre: "Carlos", apellido: "Uzcátegui", telefono: "0414-1234503" },
  { id: "paciente-demo-odonto-04", nombre: "Daniela", apellido: "Briceño", telefono: "0414-1234504" },
  { id: "paciente-demo-odonto-05", nombre: "Luis", apellido: "Moreno", telefono: "0414-1234505" },
  { id: "paciente-demo-odonto-06", nombre: "Andrea", apellido: "Valera", telefono: "0414-1234506" },
  { id: "paciente-demo-odonto-07", nombre: "Pedro", apellido: "Araujo", telefono: "0414-1234507" },
  { id: "paciente-demo-odonto-08", nombre: "Gabriela", apellido: "Dávila", telefono: "0414-1234508" },
  { id: "paciente-demo-odonto-09", nombre: "Rafael", apellido: "Mora", telefono: "0414-1234509" },
  { id: "paciente-demo-odonto-10", nombre: "Valentina", apellido: "Quintero", telefono: "0414-1234510" },
];

const MOTIVOS = [
  "Control de ortodoncia",
  "Limpieza dental",
  "Evaluación inicial",
  "Extracción",
  "Ajuste de brackets",
  "Revisión periódica",
  "Dolor dental",
  "Blanqueamiento",
];

function conHora(fecha, horas, minutos) {
  const copia = new Date(fecha);
  copia.setHours(horas, minutos, 0, 0);
  return copia;
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const organizacion = await prisma.organizacion.upsert({
    where: { id: ORG_ID },
    update: {},
    create: { id: ORG_ID, nombre: "Clínica Dental Demo" },
  });

  const usuario = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: {},
    create: {
      organizacionId: organizacion.id,
      nombre: "Dr. Demo Odontólogo",
      email: EMAIL,
      passwordHash,
      rol: "MEDICO",
    },
  });

  const medico = await prisma.medico.upsert({
    where: { usuarioId: usuario.id },
    update: {},
    create: {
      organizacionId: organizacion.id,
      usuarioId: usuario.id,
      profesion: "ODONTOLOGO",
      especialidad: "Ortodoncia",
      modalidades: ["PRESENCIAL"],
    },
  });

  // Pacientes.
  const pacientes = [];
  for (const p of PACIENTES) {
    const paciente = await prisma.paciente.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        organizacionId: organizacion.id,
        nombre: p.nombre,
        apellido: p.apellido,
        telefono: p.telefono,
      },
    });
    pacientes.push(paciente);
  }

  const hoy = new Date();
  const ayer = new Date(hoy);
  ayer.setDate(ayer.getDate() - 1);

  // --- Citas de HOY: 6, mezcla de estados --------------------------------
  const citasHoyDef = [
    { hora: [8, 0], estado: "ATENDIDA" },
    { hora: [9, 0], estado: "ATENDIDA" },
    { hora: [10, 30], estado: "CONFIRMADA" },
    { hora: [11, 30], estado: "CONFIRMADA" },
    { hora: [14, 0], estado: "CONFIRMADA" },
    { hora: [15, 30], estado: "PENDIENTE" },
  ];
  for (let i = 0; i < citasHoyDef.length; i++) {
    const def = citasHoyDef[i];
    await prisma.cita.upsert({
      where: { id: `cita-demo-odonto-hoy-${i + 1}` },
      update: {
        fechaHora: conHora(hoy, def.hora[0], def.hora[1]),
        estado: def.estado,
      },
      create: {
        id: `cita-demo-odonto-hoy-${i + 1}`,
        organizacionId: organizacion.id,
        pacienteId: pacientes[i % pacientes.length].id,
        medicoId: medico.id,
        fechaHora: conHora(hoy, def.hora[0], def.hora[1]),
        estado: def.estado,
        motivo: MOTIVOS[i % MOTIVOS.length],
      },
    });
  }

  // --- Citas de AYER: 4, para que el delta "vs. ayer" tenga con qué compararse.
  const citasAyerDef = [
    { hora: [9, 0], estado: "ATENDIDA" },
    { hora: [10, 0], estado: "ATENDIDA" },
    { hora: [11, 30], estado: "ATENDIDA" },
    { hora: [16, 0], estado: "NO_ASISTIO" },
  ];
  for (let i = 0; i < citasAyerDef.length; i++) {
    const def = citasAyerDef[i];
    await prisma.cita.upsert({
      where: { id: `cita-demo-odonto-ayer-${i + 1}` },
      update: {
        fechaHora: conHora(ayer, def.hora[0], def.hora[1]),
        estado: def.estado,
      },
      create: {
        id: `cita-demo-odonto-ayer-${i + 1}`,
        organizacionId: organizacion.id,
        pacienteId: pacientes[(i + 3) % pacientes.length].id,
        medicoId: medico.id,
        fechaHora: conHora(ayer, def.hora[0], def.hora[1]),
        estado: def.estado,
        motivo: MOTIVOS[(i + 3) % MOTIVOS.length],
      },
    });
  }

  // --- Resto del mes: para que "Actividad del mes" tenga barras más allá
  // de hoy. 1-3 citas en días pasados del mes (nunca hoy/ayer, ya cubiertos
  // arriba, ni días futuros).
  //
  // Estado variado (no todas ATENDIDA, ver changelog punto 60b): días
  // pasados reales tienen de todo — algunas canceladas, alguna sin
  // asistencia — y con todas en el mismo estado el sistema de color por
  // estado de Vista Mes (punto 59) se ve de un solo color, que es
  // justo lo que el usuario reportó al probarlo. La mayoría sigue siendo
  // ATENDIDA (lo más común en días ya pasados), pero con variedad real.
  const ESTADOS_MES_PASADO = [
    "ATENDIDA",
    "ATENDIDA",
    "ATENDIDA",
    "CANCELADA",
    "NO_ASISTIO",
  ];
  let citasMes = 0;
  const diaHoy = hoy.getDate();
  for (let dia = 1; dia < diaHoy - 1; dia++) {
    // Salta algunos días para que no sea una línea perfectamente pareja.
    const cantidad = [0, 1, 1, 2, 3][dia % 5];
    for (let n = 0; n < cantidad; n++) {
      citasMes++;
      const fecha = new Date(hoy.getFullYear(), hoy.getMonth(), dia);
      const estado = ESTADOS_MES_PASADO[(dia + n) % ESTADOS_MES_PASADO.length];
      await prisma.cita.upsert({
        where: { id: `cita-demo-odonto-mes-${dia}-${n + 1}` },
        // `update` ya no vacío (a diferencia de la versión anterior de este
        // bloque): si ya habías corrido el seed antes de este cambio, las
        // citas quedaron creadas con estado ATENDIDA fijo y un upsert con
        // `update: {}` nunca las habría actualizado al volver a correrlo.
        update: { estado },
        create: {
          id: `cita-demo-odonto-mes-${dia}-${n + 1}`,
          organizacionId: organizacion.id,
          pacienteId: pacientes[(dia + n) % pacientes.length].id,
          medicoId: medico.id,
          fechaHora: conHora(fecha, 9 + n * 2, 0),
          estado,
          motivo: MOTIVOS[(dia + n) % MOTIVOS.length],
        },
      });
    }
  }

  // --- Cobros de HOY y AYER (para el KPI "Cobros del día" y su delta). ---
  const cobrosHoyDef = [
    { monto: 45, metodoPago: "EFECTIVO_USD", moneda: "USD" },
    { monto: 30, metodoPago: "PAGO_MOVIL", moneda: "USD" },
    { monto: 60, metodoPago: "ZELLE", moneda: "USD" },
  ];
  for (let i = 0; i < cobrosHoyDef.length; i++) {
    const def = cobrosHoyDef[i];
    await prisma.cobro.upsert({
      where: { id: `cobro-demo-odonto-hoy-${i + 1}` },
      update: { fecha: conHora(hoy, 10 + i, 0), monto: def.monto },
      create: {
        id: `cobro-demo-odonto-hoy-${i + 1}`,
        organizacionId: organizacion.id,
        pacienteId: pacientes[i % pacientes.length].id,
        medicoId: medico.id,
        concepto: MOTIVOS[i % MOTIVOS.length],
        monto: def.monto,
        moneda: def.moneda,
        metodoPago: def.metodoPago,
        estado: "PAGADO",
        fecha: conHora(hoy, 10 + i, 0),
      },
    });
  }

  const cobrosAyerDef = [
    { monto: 25, metodoPago: "EFECTIVO_USD", moneda: "USD" },
    { monto: 40, metodoPago: "TRANSFERENCIA", moneda: "USD" },
  ];
  for (let i = 0; i < cobrosAyerDef.length; i++) {
    const def = cobrosAyerDef[i];
    await prisma.cobro.upsert({
      where: { id: `cobro-demo-odonto-ayer-${i + 1}` },
      update: { fecha: conHora(ayer, 11 + i, 0), monto: def.monto },
      create: {
        id: `cobro-demo-odonto-ayer-${i + 1}`,
        organizacionId: organizacion.id,
        pacienteId: pacientes[(i + 3) % pacientes.length].id,
        medicoId: medico.id,
        concepto: MOTIVOS[(i + 3) % MOTIVOS.length],
        monto: def.monto,
        moneda: def.moneda,
        metodoPago: def.metodoPago,
        estado: "PAGADO",
        fecha: conHora(ayer, 11 + i, 0),
      },
    });
  }

  console.log("\nSeed de /hoy (demo odontólogo) completado.");
  console.log(`Entra en http://localhost:3000/login con:`);
  console.log(`  Correo: ${EMAIL}`);
  console.log(`  Contraseña: ${PASSWORD}`);
  console.log(`\nPacientes: ${pacientes.length}`);
  console.log(`Citas hoy: ${citasHoyDef.length} | Citas ayer: ${citasAyerDef.length} | Citas resto del mes: ${citasMes}`);
  console.log(`Cobros hoy: ${cobrosHoyDef.length} | Cobros ayer: ${cobrosAyerDef.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

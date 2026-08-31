// Seed de desarrollo: una organización, un usuario médico, su perfil, y
// pacientes/citas de ejemplo para poder probar el flujo "Hoy" de Fase 1.
// Ejecutar con: npm run db:seed

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("Conxulty123!", 10);

  const organizacion = await prisma.organizacion.upsert({
    where: { id: "org-demo" },
    update: {},
    create: {
      id: "org-demo",
      nombre: "Consultorio Demo",
    },
  });

  const usuario = await prisma.usuario.upsert({
    where: { email: "medico@conxulty.local" },
    update: {},
    create: {
      organizacionId: organizacion.id,
      nombre: "Dra. Demo",
      email: "medico@conxulty.local",
      passwordHash,
      rol: "MEDICO",
    },
  });

  const adminPasswordHash = await bcrypt.hash("Conxulty123!", 10);

  await prisma.usuario.upsert({
    where: { email: "admin@conxulty.local" },
    update: {},
    create: {
      organizacionId: organizacion.id,
      nombre: "Admin Demo",
      email: "admin@conxulty.local",
      passwordHash: adminPasswordHash,
      rol: "ADMIN",
    },
  });

  const medico = await prisma.medico.upsert({
    where: { usuarioId: usuario.id },
    update: {},
    create: {
      usuarioId: usuario.id,
      organizacionId: organizacion.id,
      especialidad: "Medicina General",
    },
  });

  const paciente1 = await prisma.paciente.upsert({
    where: { id: "paciente-demo-1" },
    update: {},
    create: {
      id: "paciente-demo-1",
      organizacionId: organizacion.id,
      nombre: "Ana",
      apellido: "Martínez",
      telefono: "555-0101",
    },
  });

  const paciente2 = await prisma.paciente.upsert({
    where: { id: "paciente-demo-2" },
    update: {},
    create: {
      id: "paciente-demo-2",
      organizacionId: organizacion.id,
      nombre: "Luis",
      apellido: "Gómez",
      telefono: "555-0102",
    },
  });

  const hoy = new Date();
  const cita1Hora = new Date(hoy);
  cita1Hora.setHours(9, 0, 0, 0);
  const cita2Hora = new Date(hoy);
  cita2Hora.setHours(11, 30, 0, 0);

  await prisma.cita.upsert({
    where: { id: "cita-demo-1" },
    update: {},
    create: {
      id: "cita-demo-1",
      organizacionId: organizacion.id,
      pacienteId: paciente1.id,
      medicoId: medico.id,
      fechaHora: cita1Hora,
      estado: "CONFIRMADA",
      motivo: "Control general",
    },
  });

  await prisma.cita.upsert({
    where: { id: "cita-demo-2" },
    update: {},
    create: {
      id: "cita-demo-2",
      organizacionId: organizacion.id,
      pacienteId: paciente2.id,
      medicoId: medico.id,
      fechaHora: cita2Hora,
      estado: "PENDIENTE",
      motivo: "Primera consulta",
    },
  });

  console.log("Seed completado.");
  console.log("Usuario ADMIN: admin@conxulty.local / Conxulty123!");
  console.log("Usuario MEDICO: medico@conxulty.local / Conxulty123!");
  console.log("Citas de hoy: 09:00 (Ana Martínez), 11:30 (Luis Gómez)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

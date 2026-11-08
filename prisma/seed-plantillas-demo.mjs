// Seed de demostración SOLO para ver las Plantillas de Consulta por
// especialidad (ver changelog puntos 37-40/49-50) funcionando con datos
// reales — un odontólogo y un psiquiatra, cada uno con un paciente y una
// consulta EN_CURSO con los campos de su plantilla ya llenos.
//
// Ejecutar con: node prisma/seed-plantillas-demo.mjs
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

const PASSWORD = "Conxulty123!";

async function crearMedicoDeDemo({
  slug,
  nombre,
  email,
  profesion,
  especialidad,
  nombrePaciente,
  apellidoPaciente,
  camposEspecialidad,
  motivoConsulta,
}) {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const organizacion = await prisma.organizacion.upsert({
    where: { id: `org-demo-${slug}` },
    update: {},
    create: { id: `org-demo-${slug}`, nombre },
  });

  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      organizacionId: organizacion.id,
      nombre,
      email,
      passwordHash,
      rol: "MEDICO",
    },
  });

  const medico = await prisma.medico.upsert({
    where: { usuarioId: usuario.id },
    update: { profesion, especialidad },
    create: {
      usuarioId: usuario.id,
      organizacionId: organizacion.id,
      profesion,
      especialidad,
      modalidades: ["PRESENCIAL"],
    },
  });

  await prisma.sede.upsert({
    where: { id: `sede-demo-${slug}` },
    update: {},
    create: {
      id: `sede-demo-${slug}`,
      medicoId: medico.id,
      organizacionId: organizacion.id,
      municipio: "Valera",
      direccion: "Consultorio de demostración",
      horario: [],
    },
  });

  const paciente = await prisma.paciente.upsert({
    where: { id: `paciente-demo-${slug}` },
    update: {},
    create: {
      id: `paciente-demo-${slug}`,
      organizacionId: organizacion.id,
      nombre: nombrePaciente,
      apellido: apellidoPaciente,
    },
  });

  // Reusa una consulta EN_CURSO si ya existe (correr el script dos veces
  // no debe duplicar), si no, crea una nueva con los campos ya llenos.
  let consulta = await prisma.consulta.findFirst({
    where: { organizacionId: organizacion.id, pacienteId: paciente.id, medicoId: medico.id },
  });

  if (!consulta) {
    consulta = await prisma.consulta.create({
      data: {
        organizacionId: organizacion.id,
        pacienteId: paciente.id,
        medicoId: medico.id,
        motivoConsulta,
        camposEspecialidad,
      },
    });
  } else {
    consulta = await prisma.consulta.update({
      where: { id: consulta.id },
      data: { motivoConsulta, camposEspecialidad },
    });
  }

  return { email, consultaId: consulta.id };
}

async function main() {
  const odontologo = await crearMedicoDeDemo({
    slug: "odontologo",
    nombre: "Dr. Demo Odontólogo",
    email: "odontologo@conxulty.local",
    profesion: "ODONTOLOGO",
    especialidad: "Ortodoncia",
    nombrePaciente: "Paciente",
    apellidoPaciente: "Odontología Demo",
    motivoConsulta: "Control de ortodoncia",
    camposEspecialidad: {
      piezasDentales: "16, 26 (molares superiores)",
      diagnosticoOdontologico: "Caries incipiente en cara oclusal",
      procedimientoRealizado: "Ajuste de brackets + limpieza",
      proximoControl: "4 semanas",
    },
  });

  const psiquiatra = await crearMedicoDeDemo({
    slug: "psiquiatra",
    nombre: "Dra. Demo Psiquiatra",
    email: "psiquiatra@conxulty.local",
    profesion: "MEDICO",
    especialidad: "Psiquiatría",
    nombrePaciente: "Paciente",
    apellidoPaciente: "Psiquiatría Demo",
    motivoConsulta: "Control de seguimiento",
    camposEspecialidad: {
      aparienciaConducta: "Aseado, colaborador, contacto visual adecuado",
      habla: "Normal en ritmo y volumen",
      animoAfecto: "Eutímico, afecto congruente",
      pensamiento: "Lineal, sin alteraciones del contenido",
      cognicionOrientacion: "Orientado en persona, tiempo y espacio",
      juicioInsight: "Conservado",
      diagnosticoPsiquiatrico: "Trastorno de ansiedad generalizada, en seguimiento",
      tratamientoFarmacologico: "Continúa esquema actual",
    },
  });

  console.log("\nListo. Con el servidor corriendo (npm run dev):\n");
  console.log(`Odontólogo — entra en http://localhost:3000/login con:`);
  console.log(`  Correo: ${odontologo.email}`);
  console.log(`  Contraseña: ${PASSWORD}`);
  console.log(`  Luego abre: http://localhost:3000/consultas/${odontologo.consultaId}\n`);

  console.log(`Psiquiatra — entra en http://localhost:3000/login con:`);
  console.log(`  Correo: ${psiquiatra.email}`);
  console.log(`  Contraseña: ${PASSWORD}`);
  console.log(`  Luego abre: http://localhost:3000/consultas/${psiquiatra.consultaId}\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

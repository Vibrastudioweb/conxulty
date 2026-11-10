-- Datos demo adicionales para ver el OS "lleno" — pacientes, citas,
-- consultas cerradas con receta, caja abierta con cobros/gastos variados
-- (USD y Bs, varios métodos de pago) y antecedentes médicos.
--
-- Se puede correr varias veces sin duplicar nada importante: usa IDs fijos
-- con ON CONFLICT DO NOTHING para Organizacion/Usuario/Medico (mismos IDs
-- que prisma/seed.mjs: 'org-demo', medico@conxulty.local), y solo abre una
-- Caja nueva si no hay ninguna ABIERTA ya (recuerda: solo puede haber una
-- caja abierta por organización, por el índice único parcial).
--
-- Los pacientes/citas/consultas/cobros/gastos nuevos sí se insertan de
-- nuevo cada vez que lo corras (IDs con timestamp) — si ya corriste esto
-- antes y no quieres duplicar, no lo vuelvas a correr, o bórralos a mano
-- primero.

DO $$
DECLARE
  v_org_id            text := 'org-demo';
  v_medico_usuario_id text;
  v_admin_usuario_id  text;
  v_medico_id         text;
  v_caja_id           text;
  v_paciente_ids      text[] := ARRAY[
    'demo-pac-' || extract(epoch from now())::bigint || '-1',
    'demo-pac-' || extract(epoch from now())::bigint || '-2',
    'demo-pac-' || extract(epoch from now())::bigint || '-3',
    'demo-pac-' || extract(epoch from now())::bigint || '-4',
    'demo-pac-' || extract(epoch from now())::bigint || '-5'
  ];
  v_cita_id text;
  v_consulta_id text;
  v_cobro_id text;
  v_gasto_id text;
BEGIN
  -- 1) Organización demo (ya debería existir si corriste prisma/seed.mjs)
  INSERT INTO organizaciones (id, nombre, plan, "createdAt", "updatedAt")
  VALUES (v_org_id, 'Consultorio Demo', 'FICHA', now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 2) Usuario médico + admin (password 'Conxulty123!' si hay que crearlos)
  INSERT INTO usuarios (id, "organizacionId", nombre, email, "passwordHash", rol, activo, "createdAt", "updatedAt")
  VALUES ('usuario-medico-demo', v_org_id, 'Dra. Demo', 'medico@conxulty.local',
          '$2b$10$Gm8nQszDuU2XQ9KDtWoufejhNyCKsdCcAd8sH07jDJqN2XjLkyQ4m', 'MEDICO', true, now(), now())
  ON CONFLICT (email) DO NOTHING;

  INSERT INTO usuarios (id, "organizacionId", nombre, email, "passwordHash", rol, activo, "createdAt", "updatedAt")
  VALUES ('usuario-admin-demo', v_org_id, 'Admin Demo', 'admin@conxulty.local',
          '$2b$10$Gm8nQszDuU2XQ9KDtWoufejhNyCKsdCcAd8sH07jDJqN2XjLkyQ4m', 'ADMIN', true, now(), now())
  ON CONFLICT (email) DO NOTHING;

  SELECT id INTO v_medico_usuario_id FROM usuarios WHERE email = 'medico@conxulty.local';
  SELECT id INTO v_admin_usuario_id FROM usuarios WHERE email = 'admin@conxulty.local';

  -- 3) Perfil Medico vinculado a ese usuario
  INSERT INTO medicos (id, "usuarioId", "organizacionId", especialidad, profesion, "createdAt", "updatedAt")
  VALUES ('medico-demo-1', v_medico_usuario_id, v_org_id, 'Medicina General', 'MEDICO', now(), now())
  ON CONFLICT ("usuarioId") DO NOTHING;

  SELECT id INTO v_medico_id FROM medicos WHERE "usuarioId" = v_medico_usuario_id;

  -- 4) Cinco pacientes nuevos
  INSERT INTO pacientes (id, "organizacionId", nombre, apellido, "fechaNacimiento", sexo, telefono, email, "documentoIdentidad", activo, "createdAt", "updatedAt")
  VALUES
    (v_paciente_ids[1], v_org_id, 'María', 'Pérez',      '1985-03-12', 'F', '0414-1112233', 'maria.perez@example.com',   'V-12345671', true, now(), now()),
    (v_paciente_ids[2], v_org_id, 'Carlos', 'Rodríguez', '1978-07-22', 'M', '0424-2223344', 'carlos.rodriguez@example.com', 'V-12345672', true, now(), now()),
    (v_paciente_ids[3], v_org_id, 'Yoselin', 'Uzcátegui','1992-11-05', 'F', '0412-3334455', 'yoselin.uzcategui@example.com','V-12345673', true, now(), now()),
    (v_paciente_ids[4], v_org_id, 'José', 'Briceño',     '1967-01-30', 'M', '0416-4445566', 'jose.briceno@example.com',  'V-12345674', true, now(), now()),
    (v_paciente_ids[5], v_org_id, 'Génesis', 'Valera',   '2001-09-18', 'F', '0426-5556677', 'genesis.valera@example.com','V-12345675', true, now(), now());

  -- 5) Antecedentes médicos para dos de ellos
  INSERT INTO antecedentes_medicos (id, "organizacionId", "pacienteId", "medicoId", tipo, descripcion, activo, fecha, "createdAt", "updatedAt")
  VALUES
    ('demo-ant-1-' || v_paciente_ids[1], v_org_id, v_paciente_ids[1], v_medico_id, 'ALERGIA', 'Alergia a la penicilina', true, now(), now(), now()),
    ('demo-ant-2-' || v_paciente_ids[2], v_org_id, v_paciente_ids[2], v_medico_id, 'ENFERMEDAD_CRONICA', 'Hipertensión arterial controlada', true, now(), now(), now());

  -- 6) Citas: 2 pasadas (atendidas, con consulta cerrada), 2 de hoy, 2 futuras
  -- Cita 1 — pasada, atendida, con consulta cerrada y receta
  v_cita_id := 'demo-cita-1-' || v_paciente_ids[1];
  INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, "createdAt", "updatedAt")
  VALUES (v_cita_id, v_org_id, v_paciente_ids[1], v_medico_id, now() - interval '3 days' + interval '9 hours', 60, 'PRESENCIAL', 'ATENDIDA', 'Control de rutina', now(), now());

  v_consulta_id := 'demo-consulta-1-' || v_paciente_ids[1];
  INSERT INTO consultas (id, "organizacionId", "pacienteId", "medicoId", "citaId", "motivoConsulta", anamnesis, "examenFisico", evaluacion, diagnostico, tratamiento, "presionArterial", "frecuenciaCardiaca", temperatura, "saturacionOxigeno", "pesoKg", "tallaCm", estado, "fechaHora", "createdAt", "updatedAt")
  VALUES (v_consulta_id, v_org_id, v_paciente_ids[1], v_medico_id, v_cita_id,
          'Control de rutina', 'Paciente asintomática, acude a control.', 'Sin hallazgos relevantes.',
          'Paciente estable', 'Control sin hallazgos agudos', 'Continuar hábitos saludables, control en 6 meses.',
          '118/76 mmHg', 72, 36.6, 98, 68.5, 162.0, 'CERRADA', now() - interval '3 days' + interval '9 hours', now(), now());

  INSERT INTO documentos (id, "organizacionId", "consultaId", "medicoId", tipo, contenido, "fechaEmision")
  VALUES ('demo-doc-1-' || v_paciente_ids[1], v_org_id, v_consulta_id, v_medico_id, 'RECETA',
          '{"medicamentos":[{"nombre":"Acetaminofén 500mg","indicaciones":"1 tableta cada 8 horas por 3 días si hay dolor"}],"indicacionesGenerales":"Hidratación abundante, reposo relativo."}'::jsonb,
          now() - interval '3 days' + interval '9 hours');

  -- Cita 2 — pasada, atendida, con consulta cerrada y receta
  v_cita_id := 'demo-cita-2-' || v_paciente_ids[2];
  INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, "createdAt", "updatedAt")
  VALUES (v_cita_id, v_org_id, v_paciente_ids[2], v_medico_id, now() - interval '1 day' + interval '10 hours', 60, 'PRESENCIAL', 'ATENDIDA', 'Seguimiento de hipertensión', now(), now());

  v_consulta_id := 'demo-consulta-2-' || v_paciente_ids[2];
  INSERT INTO consultas (id, "organizacionId", "pacienteId", "medicoId", "citaId", "motivoConsulta", anamnesis, "examenFisico", evaluacion, diagnostico, tratamiento, "presionArterial", "frecuenciaCardiaca", temperatura, "saturacionOxigeno", "pesoKg", "tallaCm", estado, "fechaHora", "createdAt", "updatedAt")
  VALUES (v_consulta_id, v_org_id, v_paciente_ids[2], v_medico_id, v_cita_id,
          'Seguimiento de hipertensión', 'Refiere buena adherencia al tratamiento.', 'Auscultación cardiopulmonar normal.',
          'Hipertensión controlada', 'Hipertensión arterial, controlada', 'Continuar losartán 50mg OD, control en 1 mes.',
          '128/82 mmHg', 78, 36.8, 97, 84.0, 174.0, 'CERRADA', now() - interval '1 day' + interval '10 hours', now(), now());

  INSERT INTO documentos (id, "organizacionId", "consultaId", "medicoId", tipo, contenido, "fechaEmision")
  VALUES ('demo-doc-2-' || v_paciente_ids[2], v_org_id, v_consulta_id, v_medico_id, 'RECETA',
          '{"medicamentos":[{"nombre":"Losartán 50mg","indicaciones":"1 tableta cada 24 horas, en la mañana"}],"indicacionesGenerales":"Dieta baja en sodio, control de peso."}'::jsonb,
          now() - interval '1 day' + interval '10 hours');

  -- Cita 3 — hoy, confirmada, sin atender todavía
  INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, "createdAt", "updatedAt")
  VALUES ('demo-cita-3-' || v_paciente_ids[3], v_org_id, v_paciente_ids[3], v_medico_id,
          date_trunc('day', now()) + interval '14 hours', 60, 'PRESENCIAL', 'CONFIRMADA', 'Primera consulta', now(), now());

  -- Cita 4 — hoy, pendiente
  INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, "createdAt", "updatedAt")
  VALUES ('demo-cita-4-' || v_paciente_ids[4], v_org_id, v_paciente_ids[4], v_medico_id,
          date_trunc('day', now()) + interval '16 hours', 30, 'VIDEOCONSULTA', 'PENDIENTE', 'Resultados de laboratorio', now(), now());

  -- Cita 5 — futura, pendiente
  INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, "createdAt", "updatedAt")
  VALUES ('demo-cita-5-' || v_paciente_ids[5], v_org_id, v_paciente_ids[5], v_medico_id,
          now() + interval '2 days' + interval '11 hours', 30, 'PRESENCIAL', 'PENDIENTE', 'Control post-consulta', now(), now());

  -- Cita 6 — pasada, cancelada (para que la agenda no se vea toda "perfecta")
  INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, "createdAt", "updatedAt")
  VALUES ('demo-cita-6-' || v_paciente_ids[4], v_org_id, v_paciente_ids[4], v_medico_id,
          now() - interval '2 days' + interval '15 hours', 30, 'PRESENCIAL', 'CANCELADA', 'Control', now(), now());

  -- 7) Caja: abre una nueva solo si no hay ninguna ABIERTA ya
  IF NOT EXISTS (SELECT 1 FROM cajas WHERE "organizacionId" = v_org_id AND estado = 'ABIERTA') THEN
    v_caja_id := 'demo-caja-' || extract(epoch from now())::bigint;
    INSERT INTO cajas (id, "organizacionId", "abiertaPorId", "fechaApertura", "montoInicialUsd", "montoInicialBs", estado, "createdAt", "updatedAt")
    VALUES (v_caja_id, v_org_id, v_admin_usuario_id, now(), 50.00, 500.00, 'ABIERTA', now(), now());

    -- Cobro 1: ligado a la consulta 1, efectivo USD
    v_cobro_id := 'demo-cobro-1-' || v_paciente_ids[1];
    INSERT INTO cobros (id, "organizacionId", "consultaId", "pacienteId", "medicoId", concepto, monto, "descuentoMonto", moneda, "esEfectivo", "metodoPago", estado, fecha, "createdAt", "updatedAt")
    VALUES (v_cobro_id, v_org_id, 'demo-consulta-1-' || v_paciente_ids[1], v_paciente_ids[1], v_medico_id, NULL, 25.00, 0, 'USD', true, 'EFECTIVO_USD', 'PAGADO', now() - interval '3 days' + interval '9 hours', now(), now());
    INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "cobroId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
    VALUES ('demo-mov-1-' || v_paciente_ids[1], v_org_id, v_caja_id, v_cobro_id, 'INGRESO', 'COBRO', 25.00, 'USD', true, 'EFECTIVO_USD', 'Cobro consulta control', v_admin_usuario_id, now(), now());

    -- Cobro 2: ligado a la consulta 2, pago móvil en Bs (no efectivo)
    v_cobro_id := 'demo-cobro-2-' || v_paciente_ids[2];
    INSERT INTO cobros (id, "organizacionId", "consultaId", "pacienteId", "medicoId", concepto, monto, "descuentoMonto", moneda, "esEfectivo", "metodoPago", estado, fecha, "createdAt", "updatedAt")
    VALUES (v_cobro_id, v_org_id, 'demo-consulta-2-' || v_paciente_ids[2], v_paciente_ids[2], v_medico_id, NULL, 900.00, 0, 'Bs', false, 'PAGO_MOVIL', 'PAGADO', now() - interval '1 day' + interval '10 hours', now(), now());
    INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "cobroId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
    VALUES ('demo-mov-2-' || v_paciente_ids[2], v_org_id, v_caja_id, v_cobro_id, 'INGRESO', 'COBRO', 900.00, 'Bs', false, 'PAGO_MOVIL', 'Cobro seguimiento hipertensión', v_admin_usuario_id, now(), now());

    -- Cobro 3: "cobro rápido" sin consulta — venta de un insumo, efectivo USD
    v_cobro_id := 'demo-cobro-3-' || v_paciente_ids[3];
    INSERT INTO cobros (id, "organizacionId", "consultaId", "pacienteId", "medicoId", concepto, monto, "descuentoMonto", moneda, "esEfectivo", "metodoPago", estado, fecha, "createdAt", "updatedAt")
    VALUES (v_cobro_id, v_org_id, NULL, v_paciente_ids[3], v_medico_id, 'Venta de mascarillas', 5.00, 0, 'USD', true, 'EFECTIVO_USD', 'PAGADO', now(), now(), now());
    INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "cobroId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
    VALUES ('demo-mov-3-' || v_paciente_ids[3], v_org_id, v_caja_id, v_cobro_id, 'INGRESO', 'COBRO', 5.00, 'USD', true, 'EFECTIVO_USD', 'Venta de mascarillas', v_admin_usuario_id, now(), now());

    -- Gasto 1: insumos, efectivo USD
    v_gasto_id := 'demo-gasto-1-' || extract(epoch from now())::bigint;
    INSERT INTO gastos (id, "organizacionId", "cajaId", categoria, monto, moneda, "esEfectivo", "metodoPago", nota, "registradoPorId", fecha, "createdAt")
    VALUES (v_gasto_id, v_org_id, v_caja_id, 'INSUMOS', 15.00, 'USD', true, 'EFECTIVO_USD', 'Guantes y gasas', v_admin_usuario_id, now(), now());
    INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "gastoId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
    VALUES ('demo-mov-4-' || extract(epoch from now())::bigint, v_org_id, v_caja_id, v_gasto_id, 'EGRESO', 'GASTO', 15.00, 'USD', true, 'EFECTIVO_USD', 'Guantes y gasas', v_admin_usuario_id, now(), now());

    -- Gasto 2: servicios, transferencia Bs (no efectivo)
    v_gasto_id := 'demo-gasto-2-' || extract(epoch from now())::bigint;
    INSERT INTO gastos (id, "organizacionId", "cajaId", categoria, monto, moneda, "esEfectivo", "metodoPago", nota, "registradoPorId", fecha, "createdAt")
    VALUES (v_gasto_id, v_org_id, v_caja_id, 'SERVICIOS', 600.00, 'Bs', false, 'TRANSFERENCIA', 'Pago de electricidad', v_admin_usuario_id, now(), now());
    INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "gastoId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
    VALUES ('demo-mov-5-' || extract(epoch from now())::bigint, v_org_id, v_caja_id, v_gasto_id, 'EGRESO', 'GASTO', 600.00, 'Bs', false, 'TRANSFERENCIA', 'Pago de electricidad', v_admin_usuario_id, now(), now());
  END IF;

  RAISE NOTICE 'Listo: % pacientes nuevos, citas de ejemplo, 2 consultas cerradas con receta, caja % con cobros y gastos.', array_length(v_paciente_ids, 1), COALESCE(v_caja_id, '(ya había una abierta, no se tocó)');
END $$;

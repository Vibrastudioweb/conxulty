-- ============================================================================
-- MÉDICO DEMO LLENO — para mostrar CONXULTY a médicos sin que se vea vacío.
--
-- Qué hace: toma UNA cuenta de médico que ya existe (la demo) y la llena con
-- ~4 meses de historia creíble de un consultorio de medicina general:
--   · ~60 pacientes venezolanos ficticios, con antecedentes
--   · agenda de lunes a sábado: pasada, la de HOY y las próximas 2 semanas
--   · consultas cerradas con historia clínica, signos vitales y receta
--   · cobros en USD y Bs con todos los métodos de pago, algunos pendientes
--   · una caja por semana (cerradas) y la de esta semana abierta, con gastos
--   · Plan Pro de cortesía para que se vean Consultas, Caja y Reportes
--
-- CÓMO USARLO
--   1. Crea la cuenta demo por el registro normal de conxulty (tú eliges el
--      correo y la contraseña) y apruébala. El consultorio DEBE llamarse con
--      la palabra "Demo" (ej. "Consultorio Demo"): es el seguro de este script.
--   2. Escribe ese correo abajo, en v_email.
--   3. Pega TODO este archivo en Supabase → SQL Editor → Run.
--   4. Antes de cada demostración vuelve a correrlo: regenera todo relativo a
--      la fecha de hoy, así "Hoy" siempre tiene pacientes.
--
-- ⚠ BORRA Y REGENERA: cada vez que corre ELIMINA todos los pacientes, citas,
--   consultas, cobros, cajas y gastos de ESA organización (incluido lo que
--   hayas creado a mano durante una demo) y los vuelve a generar. Por eso se
--   niega a correr si la organización no tiene "demo" en el nombre. No toca
--   ninguna otra organización, ni usuarios, ni la ficha pública.
--
-- Todo va en un solo bloque: si algo falla, no queda nada a medias.
-- Los datos son ficticios (nombres, cédulas y teléfonos inventados).
-- ============================================================================

DO $$
DECLARE
  -- ───────────── AJUSTA ESTAS LÍNEAS ─────────────
  v_email        text    := 'PON-AQUI-EL-CORREO-DEL-MEDICO-DEMO';
  v_tasa         numeric := 300;   -- Bs por USD para los cobros en bolívares: pon la tasa del día
  v_activar_pro  boolean := true;  -- deja la organización demo en Plan Pro de cortesía
  -- ────────────────────────────────────────────────

  c_zona   constant text := 'America/Caracas';
  c_dias   constant int  := 120;   -- días de historia hacia atrás
  c_futuro constant int  := 14;    -- días de agenda hacia adelante
  c_total  constant int  := 60;    -- pacientes

  v_org text; v_org_nombre text; v_usuario text; v_medico text;
  v_ahora timestamp := now() AT TIME ZONE 'UTC';
  v_hoy   date      := (now() AT TIME ZONE c_zona)::date;

  nom_f text[] := ARRAY['María','Yoselin','Génesis','Ana','Carmen','Rosa','Luisa','Daniela','Valentina','Andreína','Mariana','Yelitza','Norelys','Beatriz','Gladys','Isabel','Paola','Karina','Milagros','Oriana','Dayana','Zulay','Elena','Fabiola','Nathaly','Betzabeth','Lisbeth','Ingrid','Mirna','Sofía'];
  nom_m text[] := ARRAY['Carlos','José','Luis','Pedro','Juan','Miguel','Rafael','Jesús','Ángel','Francisco','Alejandro','Daniel','Ramón','Wilmer','Yorman','Eduardo','Gustavo','Héctor','Nelson','Orlando','Simón','Víctor','Darwin','Leonardo','Freddy','Anderson','Régulo','Julio','Enrique','Tomás'];
  apes  text[] := ARRAY['Pérez','Rodríguez','Uzcátegui','Briceño','Valera','González','Hernández','Rangel','Montilla','Araujo','Barrios','Terán','Paredes','Materán','Viloria','Linares','Carrillo','Graterol','Villegas','Abreu','Peña','Rivas','Durán','Godoy','Segovia','Castellanos','Bastidas','Quintero','Torres','Morillo'];

  -- Cuadros clínicos (medicina general). Los 4 primeros son crónicos: el
  -- paciente vuelve a control por lo mismo y lleva antecedente + medicación.
  e_motivo text[] := ARRAY[
    'Control de hipertensión arterial','Control de diabetes tipo 2','Control de hipotiroidismo','Control de asma',
    'Dolor lumbar','Tos y congestión nasal','Dolor de cabeza frecuente','Acidez y dolor en la boca del estómago',
    'Ardor al orinar','Chequeo general','Dolor de garganta y fiebre','Erupción en la piel con picazón',
    'Cansancio y debilidad','Diarrea y malestar estomacal'];
  e_anamnesis text[] := ARRAY[
    'Acude a control. Refiere buena adherencia al tratamiento, sin cefalea ni mareos. Registra su tensión en casa.',
    'Acude a control. Cumple dieta de forma irregular. Niega poliuria y polidipsia. Trae glicemia en ayunas reciente.',
    'Acude a control con perfil tiroideo. Refiere menos cansancio desde el último ajuste de dosis.',
    'Refiere uso ocasional del inhalador de rescate, sobre todo en las noches y con el polvo.',
    'Dolor lumbar de 4 días de evolución tras cargar peso, sin irradiación a miembros inferiores. Mejora con reposo.',
    'Cuadro de 3 días con tos seca, rinorrea hialina y malestar general. Sin dificultad para respirar.',
    'Cefalea frontal opresiva varias veces por semana, asociada a pantallas y poco sueño. Sin náuseas ni aura.',
    'Ardor epigástrico de 2 semanas, peor en ayunas y con café. Niega vómitos y evacuaciones oscuras.',
    'Disuria y urgencia miccional de 2 días. Niega fiebre y dolor lumbar.',
    'Asintomático. Solicita evaluación general y órdenes de laboratorio de rutina.',
    'Odinofagia de 2 días con fiebre no cuantificada. Sin tos.',
    'Lesiones pruriginosas en antebrazos de 5 días, tras contacto con un detergente nuevo.',
    'Astenia de varias semanas. Alimentación irregular. Niega pérdida de peso.',
    'Evacuaciones líquidas (4–5 al día) desde ayer, sin sangre. Tolera la vía oral.'];
  e_examen text[] := ARRAY[
    'Ruidos cardíacos rítmicos, sin soplos. Sin edema en miembros inferiores.',
    'Buen estado general. Pulsos pedios presentes. Sensibilidad de los pies conservada.',
    'Tiroides no palpable. Piel hidratada. Reflejos normales.',
    'Murmullo vesicular presente, sibilantes espiratorios aislados. Sin tiraje.',
    'Contractura paravertebral lumbar. Lasègue negativo bilateral. Fuerza y sensibilidad conservadas.',
    'Orofaringe levemente congestiva. Pulmones bien ventilados, sin agregados.',
    'Examen neurológico sin focalización. Contractura cervical leve.',
    'Abdomen blando, dolor leve a la palpación en epigastrio, sin signos de irritación peritoneal.',
    'Abdomen blando, dolor leve suprapúbico. Puñopercusión renal negativa.',
    'Examen físico sin hallazgos patológicos.',
    'Amígdalas hipertróficas con exudado blanquecino. Adenopatías cervicales dolorosas.',
    'Placas eritematosas con descamación fina en ambos antebrazos, sin signos de infección.',
    'Palidez cutáneo-mucosa leve. Resto del examen sin alteraciones.',
    'Mucosas levemente secas. Abdomen blando, ruidos hidroaéreos aumentados, sin dolor a la descompresión.'];
  e_dx text[] := ARRAY[
    'Hipertensión arterial controlada','Diabetes mellitus tipo 2 en control','Hipotiroidismo en tratamiento','Asma bronquial leve persistente',
    'Lumbalgia mecánica aguda','Infección respiratoria alta de origen viral','Cefalea tensional','Gastritis aguda',
    'Infección urinaria baja no complicada','Adulto sano','Faringoamigdalitis aguda','Dermatitis de contacto',
    'Síndrome anémico en estudio','Gastroenteritis aguda'];
  e_tto text[] := ARRAY[
    'Continuar tratamiento. Dieta baja en sodio, caminar 30 minutos diarios. Control en 1 mes.',
    'Continuar tratamiento. Plan de alimentación y actividad física. Hemoglobina glicosilada para el próximo control.',
    'Mantener la dosis. Control con perfil tiroideo en 3 meses.',
    'Inhalador de mantenimiento diario y rescate si hay síntomas. Evitar polvo y humo. Control en 1 mes.',
    'Analgésico por 5 días, calor local y reposo relativo. Higiene postural. Volver si aparece adormecimiento.',
    'Tratamiento sintomático, hidratación abundante y reposo. Volver si hay fiebre alta o dificultad para respirar.',
    'Analgésico al inicio del dolor. Mejorar horas de sueño y pausas frente a pantallas.',
    'Protector gástrico por 4 semanas. Evitar café, picantes y ayunos prolongados.',
    'Antibiótico por 5 días. Abundantes líquidos. Uroanálisis de control al terminar.',
    'Se indican laboratorios de rutina. Mantener hábitos saludables. Control con resultados.',
    'Antibiótico por 7 días y antipirético si hay fiebre. Líquidos abundantes.',
    'Crema tópica por 7 días. Suspender el producto irritante. Usar guantes al lavar.',
    'Se solicita hematología completa y ferritina. Suplemento de hierro. Control con resultados.',
    'Suero oral después de cada evacuación. Dieta blanda. Volver si hay sangre o no tolera líquidos.'];
  e_med text[] := ARRAY[
    'Losartán 50 mg','Metformina 850 mg','Levotiroxina 75 mcg','Salbutamol inhalador 100 mcg',
    'Ibuprofeno 400 mg','Loratadina 10 mg','Acetaminofén 500 mg','Omeprazol 20 mg',
    'Nitrofurantoína 100 mg',NULL,'Amoxicilina 500 mg','Hidrocortisona crema 1 %',
    'Sulfato ferroso 300 mg','Sales de rehidratación oral'];
  e_ind text[] := ARRAY[
    '1 tableta cada 24 horas, en la mañana','1 tableta con el desayuno y 1 con la cena','1 tableta en ayunas, 30 minutos antes del desayuno','2 inhalaciones cada 6 horas si hay síntomas',
    '1 tableta cada 8 horas con comida, por 5 días','1 tableta cada 24 horas por 5 días','1 tableta cada 8 horas si hay dolor','1 cápsula en ayunas por 4 semanas',
    '1 cápsula cada 12 horas por 5 días',NULL,'1 cápsula cada 8 horas por 7 días','Aplicar una capa fina 2 veces al día por 7 días',
    '1 tableta al día, lejos de las comidas','Disolver 1 sobre en 1 litro de agua y tomar después de cada evacuación'];

  -- Estado por paciente (índice 1..c_total)
  p_esc   int[]  := array_fill(0, ARRAY[c_total]);   -- cuadro clínico asignado
  p_vis   int[]  := array_fill(0, ARRAY[c_total]);   -- consultas atendidas
  v_usados int := 0;

  d date; v_dow int; v_horas int[]; v_h int; v_prob numeric; v_r numeric;
  v_local timestamp; v_ts timestamp; v_pasada boolean;
  v_p int; v_pid text; v_dia int[]; v_intento int; v_esc int; v_nuevo boolean;
  v_sexo text; v_nombre text; v_estado text; v_modalidad text; v_origen text;
  v_cita text; v_consulta text; v_cobro text; v_caja text; v_lunes date; v_gasto text;
  v_usd numeric; v_metodo text; v_moneda text; v_efectivo boolean; v_monto numeric; v_pagado boolean;
  v_sis int; v_n_citas int := 0; v_n_cons int := 0; v_n_cobros int := 0;
BEGIN
  PERFORM setseed(0.42);  -- mismos datos en cada corrida (solo cambian las fechas)

  -- 0) Localizar la cuenta demo y comprobar el seguro
  SELECT u.id, u."organizacionId", o.nombre, m.id
    INTO v_usuario, v_org, v_org_nombre, v_medico
  FROM usuarios u
  JOIN organizaciones o ON o.id = u."organizacionId"
  LEFT JOIN medicos m ON m."usuarioId" = u.id
  WHERE lower(u.email) = lower(v_email);

  IF v_usuario IS NULL THEN
    RAISE EXCEPTION 'No existe ningún usuario con el correo "%". Crea primero la cuenta demo por el registro normal.', v_email;
  END IF;
  IF v_medico IS NULL THEN
    RAISE EXCEPTION 'El usuario % no tiene perfil de médico: usa una cuenta registrada como médico.', v_email;
  END IF;
  IF v_org_nombre !~* 'demo' THEN
    RAISE EXCEPTION 'SEGURO: la organización "%" no tiene "demo" en el nombre. Este script BORRA todos sus pacientes y registros, así que no corre sobre ella. Si de verdad es la cuenta demo, renómbrala (ej. "Consultorio Demo") y vuelve a correrlo.', v_org_nombre;
  END IF;

  -- 1) Limpiar SOLO esta organización (orden por dependencias)
  DELETE FROM movimientos_caja   WHERE "organizacionId" = v_org;
  DELETE FROM gastos             WHERE "organizacionId" = v_org;
  DELETE FROM cobros             WHERE "organizacionId" = v_org;
  DELETE FROM documentos         WHERE "organizacionId" = v_org;
  DELETE FROM notas_aclaratorias WHERE "organizacionId" = v_org;
  DELETE FROM consultas          WHERE "organizacionId" = v_org;
  DELETE FROM citas              WHERE "organizacionId" = v_org;
  DELETE FROM antecedentes_medicos WHERE "organizacionId" = v_org;
  DELETE FROM odontogramas       WHERE "organizacionId" = v_org;
  DELETE FROM pacientes          WHERE "organizacionId" = v_org;
  DELETE FROM cajas              WHERE "organizacionId" = v_org;

  -- 2) Plan Pro de cortesía (sin esto no se ven Consultas, Caja ni Reportes)
  IF v_activar_pro THEN
    UPDATE organizaciones SET plan = 'PRO', "updatedAt" = v_ahora WHERE id = v_org;
    INSERT INTO suscripciones (id, "organizacionId", estado, "createdAt", "updatedAt")
    VALUES ('demo-sus-' || v_org, v_org, 'CORTESIA', v_ahora, v_ahora)
    ON CONFLICT ("organizacionId") DO UPDATE SET estado = 'CORTESIA', "updatedAt" = v_ahora;
  END IF;

  -- 3) Día por día: agenda, consultas, cobros, cajas y gastos
  FOR d IN SELECT g::date FROM generate_series(v_hoy - c_dias, v_hoy + c_futuro, interval '1 day') g LOOP
    v_dow := extract(isodow FROM d);          -- 1 = lunes … 7 = domingo
    CONTINUE WHEN v_dow = 7;

    -- Una caja por semana (solo semanas que ya empezaron)
    v_lunes := date_trunc('week', d)::date;
    v_caja  := 'demo-caja-' || to_char(v_lunes, 'YYYYMMDD');
    IF d <= v_hoy AND NOT EXISTS (SELECT 1 FROM cajas WHERE id = v_caja) THEN
      v_ts := ((d + time '07:45') AT TIME ZONE c_zona) AT TIME ZONE 'UTC';
      INSERT INTO cajas (id, "organizacionId", "abiertaPorId", "fechaApertura", "montoInicialUsd", "montoInicialBs", estado, "createdAt", "updatedAt")
      VALUES (v_caja, v_org, v_usuario, LEAST(v_ts, v_ahora), 40, 0,
              (CASE WHEN v_lunes < date_trunc('week', v_hoy)::date THEN 'CERRADA' ELSE 'ABIERTA' END)::"EstadoCaja",
              LEAST(v_ts, v_ahora), v_ahora);

      -- Gastos de la semana (solo si ese momento ya pasó)
      v_ts := ((d + time '12:30') AT TIME ZONE c_zona) AT TIME ZONE 'UTC';
      IF v_ts < v_ahora THEN
        v_monto := 15 + floor(random() * 26);
        v_gasto := 'demo-gasto-i-' || to_char(v_lunes, 'YYYYMMDD');
        INSERT INTO gastos (id, "organizacionId", "cajaId", categoria, monto, moneda, "esEfectivo", "metodoPago", nota, "registradoPorId", fecha, "createdAt")
        VALUES (v_gasto, v_org, v_caja, 'INSUMOS', v_monto, 'USD', true, 'EFECTIVO_USD',
                (ARRAY['Guantes, gasas y alcohol','Papelería y recetarios','Baterías y tiras reactivas','Artículos de limpieza'])[1 + floor(random() * 4)::int],
                v_usuario, v_ts, v_ts);
        INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "gastoId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
        VALUES ('demo-mov-' || v_gasto, v_org, v_caja, v_gasto, 'EGRESO', 'GASTO', v_monto, 'USD', true, 'EFECTIVO_USD', 'Insumos', v_usuario, v_ts, v_ts);

        IF extract(day FROM v_lunes) <= 7 THEN   -- primera semana del mes: alquiler y servicios
          v_gasto := 'demo-gasto-a-' || to_char(v_lunes, 'YYYYMMDD');
          INSERT INTO gastos (id, "organizacionId", "cajaId", categoria, monto, moneda, "esEfectivo", "metodoPago", nota, "registradoPorId", fecha, "createdAt")
          VALUES (v_gasto, v_org, v_caja, 'ALQUILER', 150, 'USD', false, 'ZELLE', 'Alquiler del consultorio', v_usuario, v_ts, v_ts);
          INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "gastoId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
          VALUES ('demo-mov-' || v_gasto, v_org, v_caja, v_gasto, 'EGRESO', 'GASTO', 150, 'USD', false, 'ZELLE', 'Alquiler del consultorio', v_usuario, v_ts, v_ts);

          v_gasto := 'demo-gasto-s-' || to_char(v_lunes, 'YYYYMMDD');
          INSERT INTO gastos (id, "organizacionId", "cajaId", categoria, monto, moneda, "esEfectivo", "metodoPago", nota, "registradoPorId", fecha, "createdAt")
          VALUES (v_gasto, v_org, v_caja, 'SERVICIOS', round(18 * v_tasa, 2), 'Bs', false, 'TRANSFERENCIA', 'Internet y electricidad', v_usuario, v_ts, v_ts);
          INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "gastoId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
          VALUES ('demo-mov-' || v_gasto, v_org, v_caja, v_gasto, 'EGRESO', 'GASTO', round(18 * v_tasa, 2), 'Bs', false, 'TRANSFERENCIA', 'Internet y electricidad', v_usuario, v_ts, v_ts);
        END IF;

        IF (extract(week FROM v_lunes)::int % 2) = 0 THEN   -- quincena de la asistente
          v_gasto := 'demo-gasto-p-' || to_char(v_lunes, 'YYYYMMDD');
          INSERT INTO gastos (id, "organizacionId", "cajaId", categoria, monto, moneda, "esEfectivo", "metodoPago", nota, "registradoPorId", fecha, "createdAt")
          VALUES (v_gasto, v_org, v_caja, 'PERSONAL', 90, 'USD', true, 'EFECTIVO_USD', 'Quincena de la asistente', v_usuario, v_ts, v_ts);
          INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "gastoId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
          VALUES ('demo-mov-' || v_gasto, v_org, v_caja, v_gasto, 'EGRESO', 'GASTO', 90, 'USD', true, 'EFECTIVO_USD', 'Quincena de la asistente', v_usuario, v_ts, v_ts);
        END IF;
      END IF;
    END IF;

    -- Turnos de 60 min. Sábado solo en la mañana. El consultorio "crece":
    -- la agenda se llena más a medida que se acerca a hoy.
    IF v_dow = 6 THEN v_horas := ARRAY[8, 9, 10, 11];
    ELSE              v_horas := ARRAY[8, 9, 10, 11, 14, 15, 16, 17];
    END IF;
    v_prob := 0.42 + 0.30 * LEAST(1, GREATEST(0, (d - (v_hoy - c_dias))::numeric / c_dias));
    IF d = v_hoy THEN v_prob := 0.90; END IF;            -- hoy, agenda casi llena
    IF d > v_hoy THEN v_prob := 0.62 - 0.03 * (d - v_hoy); END IF;
    v_dia := ARRAY[]::int[];

    FOREACH v_h IN ARRAY v_horas LOOP
      CONTINUE WHEN random() > v_prob;

      v_local  := d + make_time(v_h, 0, 0);
      v_ts     := (v_local AT TIME ZONE c_zona) AT TIME ZONE 'UTC';
      v_pasada := v_ts < v_ahora - interval '20 minutes';

      -- Paciente: nuevo o uno que ya vino (sin repetir el mismo día)
      v_nuevo := v_usados < c_total AND (v_usados < 6 OR random() < 0.13);
      IF v_nuevo THEN
        v_usados := v_usados + 1;
        v_p := v_usados;
        p_esc[v_p] := 1 + floor(random() * array_length(e_motivo, 1))::int;
        v_sexo := CASE WHEN v_p % 2 = 0 THEN 'M' ELSE 'F' END;
        v_nombre := CASE WHEN v_sexo = 'F' THEN nom_f[1 + ((v_p / 2) % 30)] ELSE nom_m[1 + ((v_p / 2 - 1) % 30)] END;
        v_pid := 'demo-pac-' || lpad(v_p::text, 3, '0');
        INSERT INTO pacientes (id, "organizacionId", nombre, apellido, "fechaNacimiento", sexo, telefono, "documentoIdentidad", direccion, activo, "createdAt", "updatedAt")
        VALUES (v_pid, v_org, v_nombre, apes[1 + ((v_p * 7) % 30)] || ' ' || apes[1 + ((v_p * 11 + 3) % 30)],
                (v_hoy - ((19 + ((v_p * 37) % 58)) * 365 + (v_p * 53) % 300))::timestamp,
                v_sexo, '0412-555-' || lpad((100 + v_p)::text, 4, '0'),
                'V-' || (9000000 + v_p * 173021)::text,
                (ARRAY['Valera, sector Las Acacias','Valera, Av. Bolívar','Trujillo, centro','Carvajal','Escuque','Motatán','Valera, La Beatriz','Boconó'])[1 + (v_p % 8)],
                true, LEAST(v_ts - interval '2 days', v_ahora), v_ahora);

        IF p_esc[v_p] <= 4 THEN   -- crónicos: antecedente + medicación habitual
          INSERT INTO antecedentes_medicos (id, "organizacionId", "pacienteId", "medicoId", tipo, descripcion, activo, fecha, "createdAt", "updatedAt")
          VALUES ('demo-ant-c-' || v_p, v_org, v_pid, v_medico, 'ENFERMEDAD_CRONICA',
                  (ARRAY['Hipertensión arterial','Diabetes mellitus tipo 2','Hipotiroidismo','Asma bronquial'])[p_esc[v_p]],
                  true, LEAST(v_ts, v_ahora), LEAST(v_ts, v_ahora), v_ahora),
                 ('demo-ant-m-' || v_p, v_org, v_pid, v_medico, 'MEDICAMENTO_HABITUAL',
                  e_med[p_esc[v_p]] || ' — ' || e_ind[p_esc[v_p]],
                  true, LEAST(v_ts, v_ahora), LEAST(v_ts, v_ahora), v_ahora);
        END IF;
        IF v_p % 6 = 0 THEN
          INSERT INTO antecedentes_medicos (id, "organizacionId", "pacienteId", "medicoId", tipo, descripcion, activo, fecha, "createdAt", "updatedAt")
          VALUES ('demo-ant-a-' || v_p, v_org, v_pid, v_medico, 'ALERGIA',
                  (ARRAY['Alergia a la penicilina','Alergia a los AINEs','Alergia al yodo'])[1 + (v_p % 3)],
                  true, LEAST(v_ts, v_ahora), LEAST(v_ts, v_ahora), v_ahora);
        END IF;
        IF v_p % 9 = 0 THEN
          INSERT INTO antecedentes_medicos (id, "organizacionId", "pacienteId", "medicoId", tipo, descripcion, activo, fecha, "createdAt", "updatedAt")
          VALUES ('demo-ant-q-' || v_p, v_org, v_pid, v_medico, 'CIRUGIA',
                  (ARRAY['Apendicectomía','Cesárea','Colecistectomía'])[1 + (v_p % 3)],
                  true, LEAST(v_ts, v_ahora), LEAST(v_ts, v_ahora), v_ahora);
        END IF;
      ELSE
        v_p := NULL;
        FOR v_intento IN 1..8 LOOP
          v_p := 1 + floor(random() * v_usados)::int;
          EXIT WHEN NOT (v_p = ANY (v_dia));
          v_p := NULL;
        END LOOP;
        CONTINUE WHEN v_p IS NULL;
        v_pid := 'demo-pac-' || lpad(v_p::text, 3, '0');
      END IF;
      v_dia := v_dia || v_p;

      -- Los crónicos vuelven por lo mismo; el resto, por algo distinto cada vez
      IF p_esc[v_p] <= 4 OR p_vis[v_p] = 0 THEN v_esc := p_esc[v_p];
      ELSE v_esc := 5 + floor(random() * (array_length(e_motivo, 1) - 4))::int;
      END IF;

      v_r := random();
      v_modalidad := CASE WHEN v_r < 0.84 THEN 'PRESENCIAL' WHEN v_r < 0.95 THEN 'VIDEOCONSULTA' ELSE 'DOMICILIO' END;
      v_origen    := CASE WHEN v_nuevo AND random() < 0.45 THEN 'DIRECTORIO' ELSE 'OS' END;
      v_r := random();
      IF v_pasada THEN
        v_estado := CASE WHEN v_r < 0.07 THEN 'NO_ASISTIO' WHEN v_r < 0.14 THEN 'CANCELADA' ELSE 'ATENDIDA' END;
      ELSE
        v_estado := CASE WHEN v_r < 0.05 THEN 'CANCELADA' WHEN v_r < 0.65 THEN 'CONFIRMADA' ELSE 'PENDIENTE' END;
      END IF;

      v_cita := 'demo-cita-' || to_char(d, 'YYYYMMDD') || '-' || lpad(v_h::text, 2, '0');
      INSERT INTO citas (id, "organizacionId", "pacienteId", "medicoId", "fechaHora", "duracionMinutos", modalidad, estado, motivo, origen, "createdAt", "updatedAt")
      VALUES (v_cita, v_org, v_pid, v_medico, v_ts, 60, v_modalidad::"ModalidadCita", v_estado::"EstadoCita",
              e_motivo[v_esc], v_origen::"CitaOrigen", LEAST(v_ts - interval '3 days', v_ahora), v_ahora);
      v_n_citas := v_n_citas + 1;

      CONTINUE WHEN v_estado <> 'ATENDIDA';

      -- Consulta cerrada con historia y signos vitales
      p_vis[v_p] := p_vis[v_p] + 1;
      v_sis := CASE WHEN v_esc = 1 THEN 126 + floor(random() * 16)::int ELSE 108 + floor(random() * 18)::int END;
      v_consulta := 'demo-cons-' || to_char(d, 'YYYYMMDD') || '-' || lpad(v_h::text, 2, '0');
      INSERT INTO consultas (id, "organizacionId", "pacienteId", "medicoId", "citaId", "motivoConsulta", anamnesis, "examenFisico", evaluacion, diagnostico, tratamiento,
                             "presionArterial", "frecuenciaCardiaca", temperatura, "saturacionOxigeno", "pesoKg", "tallaCm", estado, "fechaHora", "createdAt", "updatedAt")
      VALUES (v_consulta, v_org, v_pid, v_medico, v_cita, e_motivo[v_esc], e_anamnesis[v_esc], e_examen[v_esc],
              CASE WHEN p_vis[v_p] > 1 AND v_esc <= 4 THEN 'Evolución favorable respecto al control anterior.' ELSE 'Paciente estable, sin signos de alarma.' END,
              e_dx[v_esc], e_tto[v_esc],
              v_sis || '/' || (v_sis - 42 + floor(random() * 8)::int) || ' mmHg',
              64 + floor(random() * 26)::int,
              CASE WHEN v_esc IN (6, 11) THEN 37.4 + round((random() * 1.1)::numeric, 1) ELSE 36.3 + round((random() * 0.6)::numeric, 1) END,
              95 + floor(random() * 5)::int,
              54 + ((v_p * 13) % 38) + round((random() * 1.5)::numeric, 1),
              152 + ((v_p * 17) % 32),
              'CERRADA', v_ts, v_ts, v_ts + interval '40 minutes');
      v_n_cons := v_n_cons + 1;

      IF e_med[v_esc] IS NOT NULL THEN
        INSERT INTO documentos (id, "organizacionId", "consultaId", "medicoId", tipo, contenido, "fechaEmision")
        VALUES ('demo-doc-' || to_char(d, 'YYYYMMDD') || '-' || lpad(v_h::text, 2, '0'), v_org, v_consulta, v_medico, 'RECETA',
                jsonb_build_object(
                  'medicamentos', jsonb_build_array(jsonb_build_object('nombre', e_med[v_esc], 'indicaciones', e_ind[v_esc])),
                  'indicacionesGenerales', e_tto[v_esc]),
                v_ts + interval '35 minutes');
      END IF;

      -- Cobro de la consulta
      v_usd := CASE WHEN v_modalidad = 'DOMICILIO' THEN 45 WHEN p_vis[v_p] = 1 THEN 30 ELSE 20 END;
      v_r := random();
      v_metodo := CASE WHEN v_r < 0.40 THEN 'EFECTIVO_USD' WHEN v_r < 0.68 THEN 'PAGO_MOVIL' WHEN v_r < 0.83 THEN 'ZELLE'
                       WHEN v_r < 0.91 THEN 'TRANSFERENCIA' WHEN v_r < 0.96 THEN 'EFECTIVO_BS' ELSE 'TARJETA' END;
      v_moneda   := CASE WHEN v_metodo IN ('EFECTIVO_USD', 'ZELLE') THEN 'USD' ELSE 'Bs' END;
      v_efectivo := v_metodo IN ('EFECTIVO_USD', 'EFECTIVO_BS');
      v_monto    := CASE WHEN v_moneda = 'USD' THEN v_usd ELSE round(v_usd * v_tasa, 2) END;
      -- Solo quedan por cobrar algunas consultas de las últimas 3 semanas
      v_pagado   := NOT (d >= v_hoy - 21 AND random() < 0.14);

      v_cobro := 'demo-cobro-' || to_char(d, 'YYYYMMDD') || '-' || lpad(v_h::text, 2, '0');
      INSERT INTO cobros (id, "organizacionId", "consultaId", "pacienteId", "medicoId", concepto, monto, "descuentoMonto", moneda, "esEfectivo", "metodoPago", estado, fecha, "createdAt", "updatedAt")
      VALUES (v_cobro, v_org, v_consulta, v_pid, v_medico, NULL, v_monto, 0, v_moneda, v_efectivo, v_metodo::"MetodoPago",
              (CASE WHEN v_pagado THEN 'PAGADO' ELSE 'PENDIENTE' END)::"EstadoCobro", v_ts + interval '45 minutes', v_ts + interval '45 minutes', v_ts + interval '45 minutes');
      v_n_cobros := v_n_cobros + 1;

      IF v_pagado THEN
        INSERT INTO movimientos_caja (id, "organizacionId", "cajaId", "cobroId", tipo, origen, monto, moneda, "esEfectivo", "metodoPago", descripcion, "registradoPorId", fecha, "createdAt")
        VALUES ('demo-mov-' || v_cobro, v_org, v_caja, v_cobro, 'INGRESO', 'COBRO', v_monto, v_moneda, v_efectivo, v_metodo::"MetodoPago",
                'Consulta: ' || e_motivo[v_esc], v_usuario, v_ts + interval '45 minutes', v_ts + interval '45 minutes');
      END IF;
    END LOOP;
  END LOOP;

  -- 4) Cerrar las cajas de semanas anteriores con su arqueo cuadrado;
  --    la de esta semana queda abierta.
  UPDATE cajas c SET
    "fechaCierre"      = ((to_date(right(c.id, 8), 'YYYYMMDD') + 5 + time '13:15') AT TIME ZONE c_zona) AT TIME ZONE 'UTC',
    "montoEsperadoUsd" = c."montoInicialUsd" + t.usd,
    "montoContadoUsd"  = c."montoInicialUsd" + t.usd,
    "diferenciaUsd"    = 0,
    "montoEsperadoBs"  = c."montoInicialBs" + t.bs,
    "montoContadoBs"   = c."montoInicialBs" + t.bs,
    "diferenciaBs"     = 0,
    "updatedAt"        = v_ahora
  FROM (
    SELECT c2.id,
      COALESCE(sum(CASE WHEN m.moneda = 'USD' AND m."esEfectivo" THEN CASE WHEN m.tipo = 'INGRESO' THEN m.monto ELSE -m.monto END END), 0) AS usd,
      COALESCE(sum(CASE WHEN m.moneda = 'Bs'  AND m."esEfectivo" THEN CASE WHEN m.tipo = 'INGRESO' THEN m.monto ELSE -m.monto END END), 0) AS bs
    FROM cajas c2 LEFT JOIN movimientos_caja m ON m."cajaId" = c2.id
    WHERE c2."organizacionId" = v_org
    GROUP BY c2.id
  ) t
  WHERE c.id = t.id AND c."organizacionId" = v_org
    AND to_date(right(c.id, 8), 'YYYYMMDD') < date_trunc('week', v_hoy)::date;

  RAISE NOTICE 'Listo — "%": % pacientes, % citas, % consultas con historia, % cobros. Hoy (%) tiene % citas.',
    v_org_nombre, v_usados, v_n_citas, v_n_cons, v_n_cobros, v_hoy,
    (SELECT count(*) FROM citas WHERE "organizacionId" = v_org AND id LIKE 'demo-cita-' || to_char(v_hoy, 'YYYYMMDD') || '-%');
END $$;

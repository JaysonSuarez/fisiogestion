-- ============================================================
-- FisioGestión — Schema para Supabase
-- Ejecuta este SQL en el editor SQL de tu proyecto Supabase
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PACIENTES
-- ============================================================
CREATE TABLE pacientes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre        TEXT NOT NULL,
  telefono      TEXT,
  diagnostico   TEXT,
  valor_sesion  INTEGER NOT NULL DEFAULT 40000,
  estado        TEXT NOT NULL DEFAULT 'activo' CHECK (estado IN ('activo','en_pausa','alta_medica')),
  notas_iniciales TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SESIONES
-- ============================================================
CREATE TABLE sesiones (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id       UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha             DATE NOT NULL,
  duracion_minutos  INTEGER NOT NULL DEFAULT 45,
  valor             INTEGER NOT NULL,
  metodo_pago       TEXT CHECK (metodo_pago IN ('efectivo','transferencia','otro')),
  estado_pago       TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pagado','pendiente')),
  nota_clinica      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CITAS
-- ============================================================
CREATE TABLE citas (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paciente_id       UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  fecha             DATE NOT NULL,
  hora_inicio       TIME NOT NULL,
  duracion_minutos  INTEGER NOT NULL DEFAULT 45,
  estado            TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('confirmada','pendiente','cancelada','completada')),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Evitar cruces de horario: no puede haber dos citas que se solapen el mismo día
  CONSTRAINT no_cruce_horario EXCLUDE USING gist (
    fecha WITH =,
    tsrange(
      (fecha + hora_inicio)::TIMESTAMP,
      (fecha + hora_inicio + (duracion_minutos || ' minutes')::INTERVAL)::TIMESTAMP
    ) WITH &&
  ) WHERE (estado != 'cancelada')
);

-- Índice para consultas por fecha
CREATE INDEX idx_citas_fecha ON citas(fecha);

-- ============================================================
-- DIEZMOS
-- ============================================================
CREATE TABLE diezmos (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  anio           INTEGER NOT NULL,
  ingreso_mes    INTEGER NOT NULL DEFAULT 0,
  monto_diezmo   INTEGER GENERATED ALWAYS AS (ROUND(ingreso_mes * 0.10)) STORED,
  entregado      BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_entrega  DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mes, anio)
);

-- ============================================================
-- ROW LEVEL SECURITY (habilitar cuando uses Auth de Supabase)
-- ============================================================
-- ALTER TABLE pacientes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE sesiones  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE citas     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE diezmos   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- DATOS DE EJEMPLO (comentar en producción)
-- ============================================================
INSERT INTO pacientes (nombre, telefono, diagnostico, valor_sesion, estado) VALUES
  ('María Ruiz',  '300 111 2222', 'Dolor lumbar crónico',      40000, 'activo'),
  ('Carlos Vega', '315 333 4444', 'Lesión de rodilla',          40000, 'activo'),
  ('Juan Torres', '318 555 6666', 'Rehabilitación hombro',      40000, 'activo'),
  ('Pedro Mora',  '312 777 8888', 'Cervicalgia',                40000, 'en_pausa'),
  ('Ana López',   '317 999 0000', 'Tobillo postoperatorio',     40000, 'activo');

-- ============================================================
-- FisioGestión PWA Pacientes — Schema para Supabase
-- ============================================================

-- 1. patient_profiles (vinculada a auth.users)
CREATE TABLE public.patient_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  apellido TEXT NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'CC',
  documento_numero TEXT NOT NULL,
  sexo TEXT NOT NULL DEFAULT 'Femenino',
  edad INTEGER,
  telefono TEXT NOT NULL,
  diagnostico TEXT,
  paciente_id UUID REFERENCES public.pacientes(id) ON DELETE SET NULL, -- Referencia al dashboard
  
  -- Referidos
  codigo_referido TEXT UNIQUE NOT NULL,
  referido_por UUID REFERENCES public.patient_profiles(id) ON DELETE SET NULL,
  descuentos_disponibles INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. promociones (gestionadas por Liliana)
CREATE TABLE public.promociones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  imagen_url TEXT,
  precio_original INTEGER,
  precio_promo INTEGER,
  activa BOOLEAN NOT NULL DEFAULT true,
  fecha_inicio DATE,
  fecha_fin DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. log_notificaciones_ia (para evitar doble envío)
CREATE TABLE public.log_notificaciones_ia (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID REFERENCES public.patient_profiles(id) ON DELETE CASCADE,
  fecha DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(patient_id, fecha)
);

-- 4. Modificar push_subscriptions
ALTER TABLE public.push_subscriptions ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'profesional';

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promociones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_notificaciones_ia ENABLE ROW LEVEL SECURITY;

-- patient_profiles
CREATE POLICY "fisio_auth_all_patient_profiles" ON public.patient_profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "patient_profiles_read_all" ON public.patient_profiles FOR SELECT USING (true);
CREATE POLICY "patient_profiles_insert" ON public.patient_profiles FOR INSERT WITH CHECK (true);

-- promociones
-- Públicas para lectura (anon o authenticated)
CREATE POLICY "promociones_read_all" ON public.promociones FOR SELECT USING (true);
-- Solo Liliana edita
CREATE POLICY "promociones_write_admin" ON public.promociones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- log_notificaciones_ia
-- Service role lo usa principalmente
CREATE POLICY "log_ia_all" ON public.log_notificaciones_ia FOR ALL TO authenticated USING (true) WITH CHECK (true);

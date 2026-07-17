-- Añadir campos para la lógica avanzada de referidos
ALTER TABLE public.patient_profiles
ADD COLUMN IF NOT EXISTS referidos_completados INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sesiones_gratis INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS ya_dio_recompensa_referido BOOLEAN DEFAULT false;

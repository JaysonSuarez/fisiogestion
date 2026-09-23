alter table public.reglas_cupones
  add column if not exists sesiones_minimas integer check (sesiones_minimas is null or sesiones_minimas > 0);

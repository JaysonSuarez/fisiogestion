alter table public.promociones
  add column if not exists sesiones_minimas integer
  check (sesiones_minimas is null or sesiones_minimas > 0);

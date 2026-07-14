-- ============================================================
-- RLS para las tablas de FisioGestión  (aplicada en Supabase "lilo")
-- ============================================================
-- Modelo de acceso:
--   * Panel interno: opera SIEMPRE como usuario autenticado (tras login).
--     Cualquier usuario logueado es personal de confianza (Liliana / Luisa);
--     la distinción de rol se hace en la app, no en la BD.
--   * Reserva pública (/agendar): opera como anon con acceso mínimo:
--       - puede INSERTAR solicitudes de cita (nunca leerlas)
--       - puede leer SOLO fecha/hora/estado de citas (disponibilidad),
--         nunca notas, diagnósticos ni datos del paciente.
--   * Cron y push usan service_role → ignoran RLS.
--   * Las tablas del sistema de contabilidad (ingresos, egresos,
--     pagos_ingresos, balance_cuentas, fisioterapeutas) NO se tocan aquí
--     porque esa app es pública sin login (se aseguran por separado).
-- ============================================================

-- 1. Habilitar RLS
alter table public.pacientes            enable row level security;
alter table public.sesiones             enable row level security;
alter table public.citas                enable row level security;
alter table public.diezmos              enable row level security;
alter table public.evaluaciones         enable row level security;
alter table public.ajustes_profesional  enable row level security;
alter table public.solicitudes_cita     enable row level security;
alter table public.push_subscriptions   enable row level security; -- ya tenía políticas

-- 2. Acceso completo para usuarios autenticados (panel interno)
create policy "fisio_auth_all" on public.pacientes           for all to authenticated using (true) with check (true);
create policy "fisio_auth_all" on public.sesiones            for all to authenticated using (true) with check (true);
create policy "fisio_auth_all" on public.citas               for all to authenticated using (true) with check (true);
create policy "fisio_auth_all" on public.diezmos             for all to authenticated using (true) with check (true);
create policy "fisio_auth_all" on public.evaluaciones        for all to authenticated using (true) with check (true);
create policy "fisio_auth_all" on public.ajustes_profesional for all to authenticated using (true) with check (true);
create policy "fisio_auth_all" on public.solicitudes_cita    for all to authenticated using (true) with check (true);

-- 3a. Reserva pública: anon SOLO puede INSERTAR solicitudes (no leer)
create policy "solicitudes_anon_insert" on public.solicitudes_cita for insert to anon with check (true);

-- 3b. Disponibilidad pública: anon ve SOLO fecha/hora/estado de citas
revoke all on public.citas from anon;
grant select (fecha, hora_inicio, estado) on public.citas to anon;
create policy "citas_anon_disponibilidad" on public.citas for select to anon using (true);

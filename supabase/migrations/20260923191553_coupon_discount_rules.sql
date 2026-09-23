alter table public.promociones
  add column if not exists servicios_aplicables text[] not null default '{}';

create table if not exists public.reglas_cupones (
  id uuid primary key default gen_random_uuid(),
  codigo_cupon text not null unique,
  porcentaje_descuento integer not null default 10 check (porcentaje_descuento between 0 and 100),
  servicios_aplicables text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index if not exists reglas_cupones_codigo_normalizado_idx
  on public.reglas_cupones (upper(trim(codigo_cupon)));

alter table public.reglas_cupones enable row level security;

revoke all on public.reglas_cupones from anon, authenticated;
grant select, insert, update, delete on public.reglas_cupones to authenticated;

create policy "staff_read_coupon_rules" on public.reglas_cupones
  for select to authenticated
  using (not private.is_current_patient());
create policy "staff_manage_coupon_rules" on public.reglas_cupones
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());

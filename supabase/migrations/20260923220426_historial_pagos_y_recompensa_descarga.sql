alter table public.patient_profiles
  add column if not exists descargas_gratis_disponibles integer not null default 0;

create table if not exists public.pagos_sesiones (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.sesiones(id) on delete cascade,
  paciente_id uuid not null references public.pacientes(id) on delete cascade,
  monto integer not null,
  metodo_pago text check (metodo_pago in ('efectivo', 'transferencia', 'otro')),
  fecha_pago timestamptz,
  es_historico boolean not null default false,
  creado_en timestamptz not null default now(),
  constraint pagos_sesiones_monto_no_cero check (monto <> 0)
);

create index if not exists pagos_sesiones_paciente_fecha_idx
  on public.pagos_sesiones (paciente_id, fecha_pago desc, creado_en desc);
create index if not exists pagos_sesiones_sesion_idx
  on public.pagos_sesiones (sesion_id, creado_en);

alter table public.pagos_sesiones enable row level security;
grant select, insert, update, delete on public.pagos_sesiones to authenticated;
grant all on public.pagos_sesiones to service_role;

drop policy if exists "staff_manage_session_payments" on public.pagos_sesiones;
create policy "staff_manage_session_payments" on public.pagos_sesiones
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());

drop policy if exists "patient_read_own_session_payments" on public.pagos_sesiones;
create policy "patient_read_own_session_payments" on public.pagos_sesiones
  for select to authenticated
  using (exists (
    select 1 from public.patient_profiles p
    where p.id = (select auth.uid())
      and p.paciente_id = pagos_sesiones.paciente_id
  ));

-- The old model stored only a running total. Keep it visible without inventing
-- a payment date that the previous schema never captured.
insert into public.pagos_sesiones (sesion_id, paciente_id, monto, metodo_pago, fecha_pago, es_historico)
select s.id, s.paciente_id, s.monto_pagado, s.metodo_pago, null, true
from public.sesiones s
where coalesce(s.monto_pagado, 0) > 0
  and not exists (
    select 1 from public.pagos_sesiones p
    where p.sesion_id = s.id and p.es_historico
  );

create or replace function public.registrar_pago_sesion()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  monto_nuevo integer;
  diferencia integer;
begin
  monto_nuevo := coalesce(new.monto_pagado, 0);
  if tg_op = 'INSERT' then
    diferencia := monto_nuevo;
  else
    diferencia := monto_nuevo - coalesce(old.monto_pagado, 0);
  end if;

  if diferencia <> 0 then
    insert into public.pagos_sesiones (sesion_id, paciente_id, monto, metodo_pago, fecha_pago)
    values (new.id, new.paciente_id, diferencia, new.metodo_pago, now());
  end if;
  return new;
end;
$$;

drop trigger if exists sesiones_registrar_pago on public.sesiones;
create trigger sesiones_registrar_pago
  after insert or update of monto_pagado on public.sesiones
  for each row execute function public.registrar_pago_sesion();

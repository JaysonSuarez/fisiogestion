
-- Separate patient access from the staff dashboard. Patient accounts are
-- identified by their row in patient_profiles; the staff client uses the
-- same Supabase Auth project but has no patient_profiles row.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_current_patient()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.patient_profiles p
    where p.id = (select auth.uid())
  );
$$;
revoke all on function private.is_current_patient() from public, anon;
grant execute on function private.is_current_patient() to authenticated;

alter table public.patient_profiles
  add column if not exists cuenta_activa boolean not null default true,
  add column if not exists cuenta_preparada boolean not null default false;
create unique index if not exists patient_profiles_paciente_id_key
  on public.patient_profiles (paciente_id)
  where paciente_id is not null;
drop policy if exists "patient_profiles_read_all" on public.patient_profiles;
drop policy if exists "patient_profiles_insert" on public.patient_profiles;

-- Existing self-registered accounts also need to be routed to the patient app.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'patient')
where exists (select 1 from public.patient_profiles p where p.id = u.id);

-- The app used open authenticated policies before patients had accounts.
-- Remove them before adding patient-specific row filters.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'pacientes','sesiones','citas','evaluaciones','patient_profiles',
        'promociones','log_notificaciones_ia','diezmos','ajustes_profesional',
        'solicitudes_cita','push_subscriptions'
      ])
      and roles @> array['authenticated']::name[]
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy "staff_manage_patients" on public.pacientes
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "patient_read_own_patient" on public.pacientes
  for select to authenticated
  using (exists (
    select 1 from public.patient_profiles p
    where p.id = (select auth.uid()) and p.paciente_id = pacientes.id
  ));

create policy "staff_manage_sessions" on public.sesiones
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "patient_read_own_sessions" on public.sesiones
  for select to authenticated
  using (exists (
    select 1 from public.patient_profiles p
    where p.id = (select auth.uid()) and p.paciente_id = sesiones.paciente_id
  ));

create policy "staff_manage_appointments" on public.citas
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "patient_read_own_appointments" on public.citas
  for select to authenticated
  using (exists (
    select 1 from public.patient_profiles p
    where p.id = (select auth.uid()) and p.paciente_id = citas.paciente_id
  ));

create policy "staff_manage_evaluations" on public.evaluaciones
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "patient_read_completed_evaluations" on public.evaluaciones
  for select to authenticated
  using (
    estado = 'completada'
    and exists (
      select 1 from public.patient_profiles p
      where p.id = (select auth.uid()) and p.paciente_id = evaluaciones.paciente_id
    )
  );

create policy "staff_manage_patient_profiles" on public.patient_profiles
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "patient_read_own_profile" on public.patient_profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "patient_read_promotions" on public.promociones
  for select to anon, authenticated using (true);
create policy "staff_manage_promotions" on public.promociones
  for all to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());

-- Patient sessions do not include access to clinic finances, staff settings,
-- administrative requests, or internal notification logs.
create policy "staff_manage_tithes" on public.diezmos
  for all to authenticated using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "staff_manage_professional_settings" on public.ajustes_profesional
  for all to authenticated using (not private.is_current_patient())
  with check (not private.is_current_patient());
create policy "patient_read_professional_settings" on public.ajustes_profesional
  for select to authenticated using (private.is_current_patient());
create policy "staff_manage_appointment_requests" on public.solicitudes_cita
  for all to authenticated using (not private.is_current_patient())
  with check (not private.is_current_patient());

-- A device can only register or remove its own push subscription.
drop policy if exists "patient_push_own_device" on public.push_subscriptions;
create policy "patient_push_own_device" on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()) or not private.is_current_patient())
  with check (user_id = (select auth.uid()) or not private.is_current_patient());

-- Completed evaluations become visible in the portal only after the clinician
-- marks them complete. The existing PDF generators can then export them there.
alter table public.citas
  add column if not exists paciente_notificado_1h boolean not null default false,
  add column if not exists paciente_notificado_15m boolean not null default false;

-- Patient reminders run once per minute and target the account linked to the
-- scheduled patient. Keep the old 10-minute flag for existing dashboard code.
create or replace function public.enviar_recordatorios_citas_pacientes()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
  local_ts timestamp := now() at time zone 'America/Bogota';
  minutos_actuales int := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  minutos_cita int;
  faltan int;
  edge_url text := 'https://qyvnuibggfjlaulmmljf.supabase.co/functions/v1/send-push';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dm51aWJnZ2ZqbGF1bG1tbGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjIzNDQsImV4cCI6MjA5MTMzODM0NH0.F3Ckkbcfw5OvI8eQpclB1nxs9fR-VaDjsEyLyg8OsIg';
begin
  for r in
    select c.id, c.hora_inicio, c.paciente_notificado_1h, c.paciente_notificado_15m,
      p.nombre as paciente, pp.id as user_id
    from public.citas c
    join public.pacientes p on p.id = c.paciente_id
    left join public.patient_profiles pp on pp.paciente_id = p.id
    where c.fecha = local_ts::date
      and c.estado not in ('cancelada', 'completada')
      and pp.id is not null
  loop
    minutos_cita := extract(hour from r.hora_inicio)::int * 60 + extract(minute from r.hora_inicio)::int;
    faltan := minutos_cita - minutos_actuales;

    if faltan > 50 and faltan <= 65 and not coalesce(r.paciente_notificado_1h, false) then
      perform net.http_post(
        url := edge_url,
        body := jsonb_build_object(
          'title', 'Tu sesión es en 1 hora',
          'body', 'Te esperamos en tu cita de fisioterapia.',
          'url', '/app/mis-citas',
          'target_user_id', r.user_id
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key)
      );
      update public.citas set paciente_notificado_1h = true where id = r.id;
    end if;

    if faltan > 10 and faltan <= 15 and not coalesce(r.paciente_notificado_15m, false) then
      perform net.http_post(
        url := edge_url,
        body := jsonb_build_object(
          'title', 'Tu sesión es en 15 minutos',
          'body', 'Es hora de prepararte para tu cita.',
          'url', '/app/mis-citas',
          'target_user_id', r.user_id
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key)
      );
      update public.citas set paciente_notificado_15m = true where id = r.id;
    end if;
  end loop;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'recordatorios-citas-pacientes') then
    perform cron.unschedule('recordatorios-citas-pacientes');
  end if;
end $$;
select cron.schedule('recordatorios-citas-pacientes', '* * * * *', $$ select public.enviar_recordatorios_citas_pacientes(); $$);

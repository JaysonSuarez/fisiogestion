-- ============================================================
-- Recordatorios de citas 100% en Supabase (pg_cron + pg_net)
-- (aplicada en el proyecto "lilo")
-- Reemplaza el Vercel Cron. Cada 5 min busca las citas de hoy que
-- estén a ~1h o ~10min (hora Colombia), no canceladas/completadas y
-- aún no avisadas, y dispara la Edge Function send-push. Marca
-- notificado_1h / notificado_10m para no repetir el aviso.
-- El reset de esas banderas al reprogramar lo hace la app.
-- ============================================================

create or replace function public.enviar_recordatorios_citas()
returns void
language plpgsql
security definer
set search_path = public, net
as $$
declare
  r record;
  local_ts timestamp := (now() at time zone 'America/Bogota');
  hoy date := local_ts::date;
  mins_ahora int := extract(hour from local_ts)::int * 60 + extract(minute from local_ts)::int;
  cita_mins int;
  restante int;
  edge_url text := 'https://qyvnuibggfjlaulmmljf.supabase.co/functions/v1/send-push';
  -- anon key (pública por diseño; solo invoca la Edge Function)
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5dm51aWJnZ2ZqbGF1bG1tbGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3NjIzNDQsImV4cCI6MjA5MTMzODM0NH0.F3Ckkbcfw5OvI8eQpclB1nxs9fR-VaDjsEyLyg8OsIg';
begin
  for r in
    select c.id, c.hora_inicio, c.notificado_1h, c.notificado_10m, p.nombre as paciente
    from public.citas c
    left join public.pacientes p on p.id = c.paciente_id
    where c.fecha = hoy
      and c.estado not in ('cancelada', 'completada')
  loop
    cita_mins := extract(hour from r.hora_inicio)::int * 60 + extract(minute from r.hora_inicio)::int;
    restante := cita_mins - mins_ahora;

    if restante > 50 and restante <= 65 and not coalesce(r.notificado_1h, false) then
      perform net.http_post(
        url := edge_url,
        body := jsonb_build_object(
          'title', 'Recordatorio de Cita ⏰',
          'body', 'Cita con ' || coalesce(r.paciente, 'tu paciente') || ' en aproximadamente 1 hora.',
          'url', '/agenda?cita_id=' || r.id
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key)
      );
      update public.citas set notificado_1h = true where id = r.id;
    end if;

    if restante > 0 and restante <= 15 and not coalesce(r.notificado_10m, false) then
      perform net.http_post(
        url := edge_url,
        body := jsonb_build_object(
          'title', '¡Cita en 10 minutos! 🚨',
          'body', 'La sesión con ' || coalesce(r.paciente, 'tu paciente') || ' empieza pronto.',
          'url', '/agenda?cita_id=' || r.id
        ),
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || anon_key)
      );
      update public.citas set notificado_10m = true where id = r.id;
    end if;
  end loop;
end;
$$;

-- Programar cada 5 minutos (idempotente)
do $$
begin
  if exists (select 1 from cron.job where jobname = 'recordatorios-citas') then
    perform cron.unschedule('recordatorios-citas');
  end if;
end $$;

select cron.schedule('recordatorios-citas', '*/5 * * * *', $$ select public.enviar_recordatorios_citas(); $$);

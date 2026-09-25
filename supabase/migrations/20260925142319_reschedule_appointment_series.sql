create or replace function public.reschedule_appointment_series(p_updates jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  appointment_update jsonb;
  updated_id uuid;
begin
  if p_updates is null or jsonb_typeof(p_updates) is distinct from 'array' then
    raise exception 'La lista de citas para reprogramar no es válida.';
  end if;
  if jsonb_array_length(p_updates) = 0 then
    raise exception 'La lista de citas para reprogramar no es válida.';
  end if;

  for appointment_update in select value from jsonb_array_elements(p_updates)
  loop
    update public.citas
    set fecha = (appointment_update ->> 'fecha')::date,
        hora_inicio = (appointment_update ->> 'hora_inicio')::time,
        estado = coalesce(appointment_update ->> 'estado', estado),
        notificado_1h = false,
        notificado_10m = false,
        paciente_notificado_1h = false,
        paciente_notificado_15m = false
    where id = (appointment_update ->> 'id')::uuid
    returning id into updated_id;

    if updated_id is null then
      raise exception 'No se pudo actualizar la cita %.', appointment_update ->> 'id';
    end if;
    updated_id := null;
  end loop;
end;
$$;

revoke all on function public.reschedule_appointment_series(jsonb) from public;
revoke all on function public.reschedule_appointment_series(jsonb) from anon;
grant execute on function public.reschedule_appointment_series(jsonb) to authenticated;
grant execute on function public.reschedule_appointment_series(jsonb) to service_role;

notify pgrst, 'reload schema';

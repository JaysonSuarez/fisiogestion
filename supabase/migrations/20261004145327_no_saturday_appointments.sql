-- Bloquea nuevas citas sabatinas y cambios de fecha hacia un sábado. Las citas
-- antiguas conservan sus demás funciones (por ejemplo, actualizar su estado).
create or replace function public.prevent_saturday_appointments()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if extract(dow from new.fecha) = 6
     and (tg_op = 'INSERT' or new.fecha is distinct from old.fecha) then
    raise exception 'No se pueden programar citas los sábados.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger citas_prevent_saturday
  before insert or update of fecha on public.citas
  for each row execute function public.prevent_saturday_appointments();

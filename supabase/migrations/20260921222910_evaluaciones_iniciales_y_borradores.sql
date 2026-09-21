-- Separa evaluación inicial y re-evaluación, y permite borradores persistentes.
alter table public.evaluaciones
  add column if not exists tipo text not null default 'reevaluacion',
  add column if not exists estado text not null default 'completada',
  add column if not exists datos_iniciales jsonb not null default '{}'::jsonb,
  add column if not exists autosave_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'evaluaciones_tipo_check'
      and conrelid = 'public.evaluaciones'::regclass
  ) then
    alter table public.evaluaciones
      add constraint evaluaciones_tipo_check
      check (tipo in ('inicial', 'reevaluacion'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'evaluaciones_estado_check'
      and conrelid = 'public.evaluaciones'::regclass
  ) then
    alter table public.evaluaciones
      add constraint evaluaciones_estado_check
      check (estado in ('borrador', 'completada'));
  end if;
end $$;

create unique index if not exists evaluaciones_paciente_tipo_key
  on public.evaluaciones (paciente_id, tipo);

comment on column public.evaluaciones.tipo is
  'Modalidad del documento: evaluación inicial o re-evaluación.';
comment on column public.evaluaciones.estado is
  'Estado de edición: borrador con guardado automático o evaluación completada.';
comment on column public.evaluaciones.datos_iniciales is
  'Campos del formato de evaluación inicial basado en la plantilla clínica.';
comment on column public.evaluaciones.autosave_at is
  'Última sincronización automática del borrador.';

-- Luisa deja de formar parte de FisioGestión. Los registros clínicos se
-- conservan y quedan asignados a Jeniffer en lugar de eliminarse.
update public.pacientes
set fisioterapeuta = 'Jeniffer'
where fisioterapeuta = 'Luisa';

update public.evaluaciones
set fisioterapeuta = 'Jeniffer'
where fisioterapeuta = 'Luisa';

update public.citas
set fisioterapeuta = 'Jeniffer'
where fisioterapeuta = 'Luisa';

update public.fisioterapeutas
set porcentaje_comision = 0.25,
    porcentaje_comision_referido = 0.25,
    activa = true
where nombre = 'Jeniffer';

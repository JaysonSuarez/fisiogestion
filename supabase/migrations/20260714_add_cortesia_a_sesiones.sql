-- Marca de "cortesía/deuda": planes donde la clínica le paga a Luisa su 25%
-- aunque el paciente no haya pagado, y que NO cuentan para el diezmo ni la cartera.
alter table public.sesiones
  add column if not exists cortesia boolean not null default false;

comment on column public.sesiones.cortesia is
  'Plan de cortesía/deuda: paga la comisión de Luisa aunque no haya recaudo; se excluye del diezmo y de la cartera por cobrar.';

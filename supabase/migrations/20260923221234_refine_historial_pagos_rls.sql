drop policy if exists "staff_manage_session_payments" on public.pagos_sesiones;
drop policy if exists "patient_read_own_session_payments" on public.pagos_sesiones;

create policy "read_session_payments_by_role" on public.pagos_sesiones
  for select to authenticated
  using (
    not private.is_current_patient()
    or exists (
      select 1 from public.patient_profiles p
      where p.id = (select auth.uid())
        and p.paciente_id = pagos_sesiones.paciente_id
    )
  );

create policy "staff_insert_session_payments" on public.pagos_sesiones
  for insert to authenticated
  with check (not private.is_current_patient());

create policy "staff_update_session_payments" on public.pagos_sesiones
  for update to authenticated
  using (not private.is_current_patient())
  with check (not private.is_current_patient());

create policy "staff_delete_session_payments" on public.pagos_sesiones
  for delete to authenticated
  using (not private.is_current_patient());

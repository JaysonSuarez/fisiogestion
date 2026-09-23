-- The minute-based reminder task is invoked by pg_cron as postgres.
-- It must not be callable through the public PostgREST RPC endpoint.
revoke execute on function public.enviar_recordatorios_citas_pacientes()
  from public, anon, authenticated;
grant execute on function public.enviar_recordatorios_citas_pacientes()
  to postgres;

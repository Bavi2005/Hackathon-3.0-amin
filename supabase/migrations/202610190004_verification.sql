-- Service-only deployment inspection; does not disclose user records or secrets.
create function public.deployment_health() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('tenants','sites','memberships','stops','audit_events','invitations','visits','parking_zones','iot_devices','iot_events','vehicles','rides','gps_observations')),
 'unprotected',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'client_mutable',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
 'site_foreign_keys',(select count(*)=5 from pg_catalog.pg_constraint where conname in ('visit_invitation_site','event_device_site','pickup_service','destination_service','rides_tenant_id_site_id_vehicle_id_fkey') and contype='f'),
 'retention_scheduled',exists(select 1 from cron.job where jobname='smarttownship-retention' and active));
$$;
revoke all on function public.deployment_health() from public,anon,authenticated;
grant execute on function public.deployment_health() to service_role;

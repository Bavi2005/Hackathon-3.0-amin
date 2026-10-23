-- Aggregated operations pulse: no visitor identity, driver GPS, or cross-tenant record details.
-- Operator privilege checked server-side. Safe for the fictional pilot; available
-- across authorized tenant summaries without granting access to raw private rows.
create or replace function public.get_platform_activity()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
  if not private.platform_allowed() then
    raise exception 'Forbidden' using errcode='42501';
  end if;
  select jsonb_build_object(
    'visitors', (select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo),
    'onsite', (select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and v.status='onsite'),
    'rides', (select count(*) from public.rides r join public.tenants t on t.id=r.tenant_id where t.demo),
    'ride_requests', (select count(*) from public.rides r join public.tenants t on t.id=r.tenant_id where t.demo and r.status='requested'),
    'shuttles', (select count(*) from public.vehicles v join public.tenants t on t.id=v.tenant_id where t.demo),
    'routes', (select count(*) from public.transport_routes r join public.tenants t on t.id=r.tenant_id where t.demo and r.published),
    'parking_zones', (select count(*) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo),
    'parking_capacity', (select coalesce(sum(z.capacity),0) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo and z.kind='counter'),
    'fresh_parking_zones', (select count(*) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo and z.kind='counter' and z.observed_at > now() - interval '120 seconds'),
    'activity', (select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
        select a.action, a.created_at from public.audit_events a
        join public.tenants t on t.id=a.tenant_id where t.demo
        order by a.created_at desc limit 8
    ) q)
  ) into result;
  return result;
end $$;
revoke all on function public.get_platform_activity() from public,anon,authenticated;
grant execute on function public.get_platform_activity() to authenticated;

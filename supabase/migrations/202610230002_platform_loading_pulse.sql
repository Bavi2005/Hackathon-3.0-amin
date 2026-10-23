-- Authorized aggregate pulse for fictional demo; no private visitor names, plates or coordinates.
create or replace function public.get_platform_activity()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
 if not private.platform_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object(
  'visitors',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo),
  'onsite',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and v.status='onsite'),
  'visitors_today',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and v.created_at>=date_trunc('day',now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur'),
  'rides',(select count(*) from public.rides r join public.tenants t on t.id=r.tenant_id where t.demo),
  'ride_requests',(select count(*) from public.rides r join public.tenants t on t.id=r.tenant_id where t.demo and r.status='requested'),
  'shuttles',(select count(*) from public.vehicles v join public.tenants t on t.id=v.tenant_id where t.demo),
  'routes',(select count(*) from public.transport_routes r join public.tenants t on t.id=r.tenant_id where t.demo and r.published),
  'parking_zones',(select count(*) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo),
  'parking_capacity',(select coalesce(sum(z.capacity),0) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo and z.kind='counter'),
  'fresh_parking_zones',(select count(*) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo and z.kind='counter' and z.observed_at>now()-interval '120 seconds'),
  'known_free_parking',(select coalesce(sum(greatest(0,z.capacity-z.occupied)),0) from public.parking_zones z join public.tenants t on t.id=z.tenant_id where t.demo and z.kind='counter' and z.observed_at>now()-interval '120 seconds' and z.occupied between 0 and z.capacity),
  'parking_facilities',(select count(*) from public.parking_facilities f join public.tenants t on t.id=f.tenant_id where t.demo),
  'loading_total',(select count(*) from private.loading_sessions l join public.tenants t on t.id=l.tenant_id where t.demo),
  'loading_active',(select count(*) from private.loading_sessions l join public.tenants t on t.id=l.tenant_id where t.demo and l.status='loading'),
  'loading_completed',(select count(*) from private.loading_sessions l join public.tenants t on t.id=l.tenant_id where t.demo and l.status='departed'),
  'locations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.site_name),'[]'::jsonb) from (
    select s.id site_id,s.name site_name,t.name township_name,
    (select count(*) from public.visits v where v.site_id=s.id) visitors,
    (select count(*) from private.loading_sessions l where l.site_id=s.id) loading_total,
    (select count(*) from private.loading_sessions l where l.site_id=s.id and l.status='loading') loading_active,
    (select count(*) from public.parking_facilities f where f.site_id=s.id) facilities
    from public.sites s join public.tenants t on t.id=s.tenant_id where t.demo order by t.name,s.name limit 100
  ) x),
  'activity',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
    select a.action,a.created_at from public.audit_events a join public.tenants t on t.id=a.tenant_id
    where t.demo order by a.created_at desc limit 8
  ) q)
 ) into result;
 return result;
end$$;
revoke all on function public.get_platform_activity() from public,anon,authenticated;
grant execute on function public.get_platform_activity() to authenticated;

-- Aggregate-only cross-township telemetry for explicitly authorized platform operators.
-- No private visitor names, number plates, phone numbers, GPS or form answers.
-- Every source below is restricted to the fictional test/demo tenants.
create or replace function public.get_platform_activity()
returns jsonb language plpgsql security definer set search_path=''
as $$
declare result jsonb;
begin
 if not private.platform_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object(
  'generated_at',now(),
  'visitors',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo),
  'onsite',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and v.status='onsite'),
  'visitors_today',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and (v.created_at at time zone 'Asia/Kuala_Lumpur')::date=(now() at time zone 'Asia/Kuala_Lumpur')::date),
  'pending_entry',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and v.status='pending_entry'),
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
  'locations',(select coalesce(jsonb_agg(to_jsonb(x) order by x.township_name,x.site_name),'[]'::jsonb) from (
   select s.id site_id,s.name site_name,t.name township_name,
   (select count(*) from public.visits v where v.site_id=s.id) visitors,
   (select count(*) from public.visits v where v.site_id=s.id and v.status='onsite') onsite,
   (select count(*) from public.visits v where v.site_id=s.id and v.status='pending_entry') pending,
   (select count(*) from private.loading_sessions l where l.site_id=s.id) loading_total,
   (select count(*) from private.loading_sessions l where l.site_id=s.id and l.status='loading') loading_active,
   (select count(*) from public.parking_facilities f where f.site_id=s.id) facilities,
   (select count(*) from public.parking_zones z where z.site_id=s.id and z.kind='counter') counter_zones,
   (select count(*) from public.parking_zones z where z.site_id=s.id and z.kind='counter' and z.observed_at>now()-interval '120 seconds') zones_reporting,
   (select coalesce(sum(greatest(0,z.capacity-z.occupied)),0) from public.parking_zones z where z.site_id=s.id and z.kind='counter' and z.occupied between 0 and z.capacity and z.observed_at>now()-interval '120 seconds') known_free,
   (select count(*) from public.rides r where r.site_id=s.id and r.status='requested') rides_waiting,
   (select count(*) from public.memberships m where m.site_id=s.id and m.active) staff_accounts
   from public.sites s join public.tenants t on t.id=s.tenant_id where t.demo order by t.name,s.name limit 100
  ) x),
  'facilities',(select coalesce(jsonb_agg(to_jsonb(x) order by x.township_name,x.facility_name),'[]'::jsonb) from (
   select f.id facility_id,f.name facility_name,s.name site_name,t.name township_name,
   (select count(*) from public.parking_levels l where l.facility_id=f.id) levels,
   (select count(*) from public.parking_zones z join public.parking_levels l on l.id=z.level_id where l.facility_id=f.id) zones,
   (select count(*) from public.parking_zones z join public.parking_levels l on l.id=z.level_id where l.facility_id=f.id and z.kind='counter' and z.observed_at>now()-interval '120 seconds') fresh_counters,
   (select coalesce(sum(z.capacity),0) from public.parking_zones z join public.parking_levels l on l.id=z.level_id where l.facility_id=f.id and z.kind='counter') counter_capacity,
   (select coalesce(sum(greatest(0,z.capacity-z.occupied)),0) from public.parking_zones z join public.parking_levels l on l.id=z.level_id where l.facility_id=f.id and z.kind='counter' and z.occupied between 0 and z.capacity and z.observed_at>now()-interval '120 seconds') known_free,
   (select count(*) from public.parking_bays b join public.parking_zones z on z.id=b.zone_id join public.parking_levels l on l.id=z.level_id where l.facility_id=f.id and b.status='FREE' and b.observed_at>now()-interval '120 seconds') individually_free_bays,
   (select count(*) from public.parking_bays b join public.parking_zones z on z.id=b.zone_id join public.parking_levels l on l.id=z.level_id where l.facility_id=f.id) individually_tracked_bays
   from public.parking_facilities f join public.sites s on s.id=f.site_id join public.tenants t on t.id=f.tenant_id where t.demo order by t.name,s.name,f.name limit 100
  ) x),
  'daily_trends',(select coalesce(jsonb_agg(jsonb_build_object(
   'date',days.day,
   'visitors',(select count(*) from public.visits v join public.tenants t on t.id=v.tenant_id where t.demo and (v.created_at at time zone 'Asia/Kuala_Lumpur')::date=days.day),
   'loading',(select count(*) from private.loading_sessions l join public.tenants t on t.id=l.tenant_id where t.demo and (l.checked_in_at at time zone 'Asia/Kuala_Lumpur')::date=days.day),
   'rides',(select count(*) from public.rides r join public.tenants t on t.id=r.tenant_id where t.demo and (r.created_at at time zone 'Asia/Kuala_Lumpur')::date=days.day)
  ) order by days.day),'[]'::jsonb) from (
   select (now() at time zone 'Asia/Kuala_Lumpur')::date - n as day from generate_series(6,0,-1) n
  ) days),
  'activity',(select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) from (
   select a.action,a.created_at from public.audit_events a join public.tenants t on t.id=a.tenant_id
   where t.demo order by a.created_at desc limit 12
  ) q)
 ) into result;
 return result;
end$$;
revoke all on function public.get_platform_activity() from public,anon,authenticated;
grant execute on function public.get_platform_activity() to authenticated;

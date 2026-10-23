-- FICTIONAL SHOWCASE ONLY. Re-runnable seed; never run against a real site.
DO $demo$
declare s uuid;t uuid;f uuid;l uuid;actor uuid;i int;
begin
 if not exists(select 1 from private.runtime_settings where environment in ('development','test') and simulations_enabled)
   then raise exception 'Fictional demo loading seed requires test/development simulator'; end if;
 select st.id,st.tenant_id into strict s,t from public.sites st join public.tenants x on x.id=st.tenant_id
 where x.demo and x.name like 'Demo Elmina %' and st.name='Demo Elmina Community Hub';
 select user_id into strict actor from public.memberships where site_id=s and role='SITE_MANAGER' and active limit 1;
 select id into strict f from public.parking_facilities where site_id=s and name='Fictional Elmina Community Mall';
 select id into strict l from public.parking_levels where site_id=s and facility_id=f and name='P1 · Retail Parking';
 for i in 1..7 loop
  insert into private.loading_sessions(id,tenant_id,site_id,facility_id,level_id,vehicle_ref,delivery_ref,status,created_by,checked_in_at,checked_out_at)
  values(md5('amin-loading-session:'||s::text||':'||i)::uuid,t,s,f,l,
    'DEMO-VAN-'||lpad(i::text,2,'0'),'FICTIONAL-LOAD-'||lpad(i::text,4,'0'),
    case when i<=2 then 'loading' else 'departed' end,actor,
    now()-make_interval(mins=>i*38),
    case when i<=2 then null else now()-make_interval(mins=>i*38-22) end)
  on conflict do nothing;
 end loop;
end$demo$;

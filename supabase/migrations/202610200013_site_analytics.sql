create function public.get_site_analytics(p_site uuid,p_from timestamptz,p_until timestamptz) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; visitors jsonb; transport jsonb; parking jsonb; daily jsonb;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id,'analytics.read') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_from is null or p_until is null or not isfinite(p_from) or not isfinite(p_until) or p_until<=p_from or p_until-p_from>interval '31 days' then
   raise exception 'Choose an ordered date range of at most 31 days' using errcode='22023'; end if;
 select jsonb_build_object('registrations',count(*),'entered',count(*) filter(where entered_at is not null),'departed',count(*) filter(where exited_at is not null),
   'onsite_in_cohort',count(*) filter(where status='onsite'),'average_registration_to_entry_minutes',avg(extract(epoch from entered_at-created_at)/60) filter(where entered_at is not null))
 into visitors from public.visits where site_id=s.id and created_at>=p_from and created_at<p_until;
 visitors:=visitors||jsonb_build_object('assisted_registrations',(select count(*) from public.audit_events where site_id=s.id and action='visitor.assisted.registered' and created_at>=p_from and created_at<p_until));
 select jsonb_build_object('requests',count(*),'completed',count(*) filter(where status='completed'),'cancelled',count(*) filter(where status='cancelled'),
 'active',count(*) filter(where status in ('requested','assigned','boarded')),'wait_sample_size',count(*) filter(where boarded_at is not null),
 'average_wait_minutes',avg(extract(epoch from boarded_at-created_at)/60) filter(where boarded_at is not null))
 into transport from public.rides where site_id=s.id and created_at>=p_from and created_at<p_until;
 select jsonb_build_object('zones',count(*),'counter_zones',count(*) filter(where kind='counter'),'bay_zones',count(*) filter(where kind='bay'),
 'stale_counter_zones',count(*) filter(where kind='counter' and (observed_at is null or observed_at<now()-interval '120 seconds')),
 'active_manual_overrides',(select count(*) from private.parking_overrides where site_id=s.id and expires_at>now()),
 'bays',(select count(*) from public.parking_bays where site_id=s.id),
 'unknown_or_stale_bays',(select count(*) from public.parking_bays where site_id=s.id and (status='UNKNOWN' or observed_at is null or observed_at<now()-interval '120 seconds')),
 'active_devices',(select count(*) from public.iot_devices where site_id=s.id and active),
 'suspended_devices',(select count(*) from public.iot_devices where site_id=s.id and not active))
 into parking from public.parking_zones where site_id=s.id;
 select coalesce(jsonb_agg(jsonb_build_object('date',day,'registrations',registrations) order by day),'[]'::jsonb) into daily from
 (select (created_at at time zone 'Asia/Kuala_Lumpur')::date as day,count(*) registrations from public.visits where site_id=s.id and created_at>=p_from and created_at<p_until group by day) d;
 perform private.audit(s.tenant_id,s.id,'analytics.read',s.id);
 return jsonb_build_object('generated_at',now(),'from',p_from,'until',p_until,'timezone','Asia/Kuala_Lumpur','visitors',visitors,'transport',transport,'parking_now',parking,'daily_visitors',daily,
 'definitions','Visitor and transport counts use registrations/requests created in the selected window. Waiting averages include timestamped rows only. Parking is a current snapshot; stale counters may have a separately counted manual override. No source accuracy or live ETA is inferred.');
end$$;
revoke all on function public.get_site_analytics(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_site_analytics(uuid,timestamptz,timestamptz) to authenticated;

create or replace function public.deployment_health() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('tenants','sites','memberships','stops','audit_events','invitations','visits','parking_zones','iot_devices','iot_events','vehicles','rides','gps_observations','visitor_form_versions','visitor_form_responses','parking_facilities','parking_levels','parking_bays','transport_routes')),
 'unprotected',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'client_mutable',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
 'site_foreign_keys',(select count(*)=5 from pg_catalog.pg_constraint where conname in ('visit_invitation_site','event_device_site','pickup_service','destination_service','rides_tenant_id_site_id_vehicle_id_fkey') and contype='f'),
 'retention_scheduled',exists(select 1 from cron.job where jobname='smarttownship-retention' and active));
$$;

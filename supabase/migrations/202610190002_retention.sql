-- Supabase Cron runs independently of the optional Render bridge.
create extension if not exists pg_cron;
create function private.retain() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.gps_observations where observed_at<now()-interval '24 hours';
 update public.vehicles set lat=null,lng=null,accuracy=null,observed_at=null where observed_at<now()-interval '24 hours';
 delete from public.iot_events where created_at<now()-interval '7 days';
 update public.visits set guest_name='[retained anonymously]' where created_at<now()-interval '30 days' and guest_name<>'[retained anonymously]';
 -- Audit rows contain no names, tokens or coordinates; retain for 90 days in this prototype.
 delete from public.audit_events where created_at<now()-interval '90 days';
end$$;
revoke all on function private.retain() from public,anon,authenticated;
select cron.schedule('smarttownship-retention','17 * * * *','select private.retain()');

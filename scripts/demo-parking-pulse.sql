-- Demo-only parking heartbeat. Execute only on the dedicated fictional/test Supabase project.
-- Never install in a real township, and never present these values as physical sensor readings.
-- Requires pg_cron already installed by the existing retention migration.
create or replace function private.tick_fictional_parking(p_site uuid default null)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  changes integer := 0;
  counts integer := 0;
  tick bigint := floor(extract(epoch from clock_timestamp()) / 60)::bigint;
begin
  if not exists (
    select 1 from private.runtime_settings
    where environment in ('test','development') and simulations_enabled
  ) then
    return 0;
  end if;

  -- Only the named, fictional Elmina showcase; all observations must already be simulated.
  update public.parking_zones z
     set occupied = greatest(0,least(z.capacity,
         round(z.capacity * 0.58)::integer
         + ((tick + ('x' || left(md5(z.id::text),6))::bit(24)::int) % 11)::integer - 5)),
         observed_at = clock_timestamp()
    from public.tenants t
   where z.tenant_id = t.id
     and t.demo and t.name like 'Demo Elmina %'
     and (p_site is null or z.site_id = p_site)
     and z.kind = 'counter'
     and z.simulated = true;
  get diagnostics counts = row_count;
  changes := changes + counts;

  -- The UI uses the normal expiring bay observation contract and Realtime source.
  -- We keep a clearly marked out-of-service space; the other bays change in a
  -- reproducible pattern, never masquerading as connected physical sensors.
  update public.parking_bays b
     set status = case
       when b.label = 'P1-10' then 'OUT_OF_SERVICE'
       when ((tick + right(b.label,2)::integer) % 4) = 0 then 'FREE'
       when ((tick + right(b.label,2)::integer) % 4) = 1 then 'OCCUPIED'
       when ((tick + right(b.label,2)::integer) % 4) = 2 then 'FREE'
       else 'OCCUPIED' end,
         observed_at = clock_timestamp(),
         simulated = true
    from public.tenants t, public.parking_zones z
   where b.tenant_id=t.id and b.zone_id=z.id
     and t.demo and t.name like 'Demo Elmina %'
     and (p_site is null or b.site_id=p_site)
     and z.kind='bay'
     and b.label ~ '^P1-[0-9]{2}$'
     and (b.simulated or b.status='UNKNOWN');
  get diagnostics counts = row_count;
  changes := changes + counts;
  return changes;
end $$;

revoke all on function private.tick_fictional_parking(uuid) from public, anon, authenticated;

-- A named job is idempotent: rerunning replaces rather than duplicates the heartbeat.
select cron.schedule(
  'smarttownship-demo-parking-pulse',
  '* * * * *',
  $job$select private.tick_fictional_parking(null::uuid)$job$
);

-- For a final manual demo refresh, the trusted SQL editor may run:
-- select private.tick_fictional_parking(null::uuid);
-- To stop the fake activity, execute:
-- select cron.unschedule('smarttownship-demo-parking-pulse');
-- Never disable the stale-observation rule in packages/contracts/freshness.ts.

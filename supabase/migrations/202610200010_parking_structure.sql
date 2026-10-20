create table public.parking_facilities(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 100),details text not null default '' check(length(details)<=500),
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id),unique(tenant_id,site_id,id)
);
create table public.parking_levels(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,facility_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 80),
 foreign key(tenant_id,site_id,facility_id) references public.parking_facilities(tenant_id,site_id,id),unique(tenant_id,site_id,id)
);
alter table public.parking_zones add column level_id uuid;
alter table public.parking_zones add column kind text not null default 'counter' check(kind in ('counter','bay'));
alter table public.parking_zones add foreign key(tenant_id,site_id,level_id) references public.parking_levels(tenant_id,site_id,id);
create table public.parking_bays(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,zone_id uuid not null,
 label text not null check(length(btrim(label)) between 1 and 40),accessible boolean not null default false,
 status text not null default 'UNKNOWN' check(status in ('FREE','OCCUPIED','UNKNOWN','OUT_OF_SERVICE')),
 observed_at timestamptz,simulated boolean not null default false,
 foreign key(tenant_id,site_id,zone_id) references public.parking_zones(tenant_id,site_id,id),
 unique(tenant_id,site_id,zone_id,id),unique(zone_id,label)
);
alter table public.iot_devices add column bay_id uuid;
alter table public.iot_devices add foreign key(tenant_id,site_id,zone_id,bay_id) references public.parking_bays(tenant_id,site_id,zone_id,id);
create unique index one_device_per_bay on public.iot_devices(bay_id) where bay_id is not null;
do $$declare n text;begin
 foreach n in array array['parking_facilities','parking_levels','parking_bays'] loop
   execute format('alter table public.%I enable row level security',n);
   execute format('revoke all on public.%I from public,anon,authenticated',n);
   execute format('grant select on public.%I to authenticated',n);
   execute format('create policy scoped_read on public.%I for select to authenticated using(private.allowed(tenant_id,site_id))',n);
 end loop;
end$$;
create table private.parking_overrides(
 zone_id uuid primary key,tenant_id uuid not null,site_id uuid not null,occupied int not null check(occupied>=0),
 reason text not null check(reason in ('sensor_outage','verified_count','maintenance')),
 created_at timestamptz not null default now(),expires_at timestamptz not null,actor uuid not null references auth.users,
 foreign key(tenant_id,site_id,zone_id) references public.parking_zones(tenant_id,site_id,id)
);
alter table private.parking_overrides enable row level security;
revoke all on private.parking_overrides from public,anon,authenticated;

create function private.check_parking_capacity() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (select count(*) from public.parking_bays where zone_id=new.id)>new.capacity or
 exists(select 1 from private.parking_overrides where zone_id=new.id and expires_at>now() and occupied>new.capacity) then
   raise exception 'Capacity conflicts with configured bays or active manual count' using errcode='23514'; end if;
 return new;
end$$;
revoke all on function private.check_parking_capacity() from public,anon,authenticated;
create trigger check_parking_capacity before update of capacity on public.parking_zones for each row execute function private.check_parking_capacity();
create function private.check_parking_device_binding() returns trigger language plpgsql security definer set search_path='' as $$
declare kind text;
begin
 select z.kind into kind from public.parking_zones z where z.id=new.zone_id;
 if (kind='bay') is distinct from (new.bay_id is not null) then raise exception 'Device binding must match zone observation type' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.zone_id is distinct from old.zone_id or new.bay_id is distinct from old.bay_id) then raise exception 'Device binding is immutable' using errcode='23514'; end if;
 return new;
end$$;
revoke all on function private.check_parking_device_binding() from public,anon,authenticated;
create trigger check_parking_device_binding before insert or update on public.iot_devices for each row execute function private.check_parking_device_binding();

create function public.create_parking_structure(p_site uuid,p_id uuid,p_type text,p_parent uuid,p_name text,p_details text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.sites;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'parking.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 80 or p_details is null or length(p_details)>500 then raise exception 'Invalid parking structure' using errcode='22023'; end if;
 if p_type='facility' and p_parent is null then
   if exists(select 1 from public.parking_facilities where id=p_id and site_id=s.id and name=btrim(p_name) and details=p_details) then return p_id; end if;
   insert into public.parking_facilities(id,tenant_id,site_id,name,details) values(p_id,s.tenant_id,s.id,btrim(p_name),p_details);
 elsif p_type='level' and exists(select 1 from public.parking_facilities where id=p_parent and site_id=s.id) then
   if exists(select 1 from public.parking_levels where id=p_id and site_id=s.id and facility_id=p_parent and name=btrim(p_name)) then return p_id; end if;
   insert into public.parking_levels(id,tenant_id,site_id,facility_id,name) values(p_id,s.tenant_id,s.id,p_parent,btrim(p_name));
 else raise exception 'Invalid parking hierarchy' using errcode='22023'; end if;
 perform private.audit(s.tenant_id,s.id,'parking.'||p_type||'.created',p_id);return p_id;
end$$;
revoke all on function public.create_parking_structure(uuid,uuid,text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_parking_structure(uuid,uuid,text,uuid,text,text) to authenticated;

create function public.configure_parking_zone(p_zone uuid,p_level uuid,p_kind text,p_expected int) returns void language plpgsql security definer set search_path='' as $$
declare z public.parking_zones;
begin
 select * into z from public.parking_zones where id=p_zone for update;
 if not private.allowed(z.tenant_id,z.site_id,'parking.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if z.revision is distinct from p_expected then raise exception 'Parking zone changed; reload before saving' using errcode='22023'; end if;
 if p_kind is null or p_kind not in ('counter','bay') or not exists(select 1 from public.parking_levels where id=p_level and site_id=z.site_id) then raise exception 'Invalid parking hierarchy' using errcode='22023'; end if;
 if p_kind<>z.kind and (z.observed_at is not null or exists(select 1 from public.iot_devices where zone_id=z.id) or exists(select 1 from public.parking_bays where zone_id=z.id)) then
   raise exception 'Observation type cannot change after devices, bays or observations exist' using errcode='22023'; end if;
 update public.parking_zones set level_id=p_level,kind=p_kind,revision=revision+1 where id=z.id;
 perform private.audit(z.tenant_id,z.site_id,'parking.zone.hierarchy.updated',z.id);
end$$;
revoke all on function public.configure_parking_zone(uuid,uuid,text,int) from public,anon,authenticated;
grant execute on function public.configure_parking_zone(uuid,uuid,text,int) to authenticated;

create function public.create_parking_bay(p_zone uuid,p_id uuid,p_label text,p_accessible boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare z public.parking_zones;
begin
 select * into z from public.parking_zones where id=p_zone for update;
 if not private.allowed(z.tenant_id,z.site_id,'parking.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_label is null or length(btrim(p_label)) not between 1 and 40 or p_accessible is null or z.kind<>'bay' then raise exception 'Invalid bay or observation type' using errcode='22023'; end if;
 if exists(select 1 from public.parking_bays where id=p_id and zone_id=z.id and label=btrim(p_label) and accessible=p_accessible) then return p_id; end if;
 if (select count(*) from public.parking_bays where zone_id=z.id)>=z.capacity then raise exception 'Bay count cannot exceed zone capacity' using errcode='22023'; end if;
 insert into public.parking_bays(id,tenant_id,site_id,zone_id,label,accessible) values(p_id,z.tenant_id,z.site_id,z.id,btrim(p_label),p_accessible);
 perform private.audit(z.tenant_id,z.site_id,'parking.bay.created',p_id);return p_id;
end$$;
revoke all on function public.create_parking_bay(uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.create_parking_bay(uuid,uuid,text,boolean) to authenticated;

create function public.create_bay_device(p_bay uuid,p_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare b public.parking_bays;
begin
 select * into b from public.parking_bays where id=p_bay for update;
 if not private.allowed(b.tenant_id,b.site_id,'parking.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null then raise exception 'Invalid device identifier' using errcode='22023'; end if;
 if exists(select 1 from public.iot_devices where id=p_id and bay_id=b.id) then return p_id; end if;
 insert into public.iot_devices(id,tenant_id,site_id,zone_id,bay_id,active) values(p_id,b.tenant_id,b.site_id,b.zone_id,b.id,false);
 perform private.audit(b.tenant_id,b.site_id,'parking.bay.device.registered',p_id);return p_id;
end$$;
revoke all on function public.create_bay_device(uuid,uuid) from public,anon,authenticated;
grant execute on function public.create_bay_device(uuid,uuid) to authenticated;

-- Database source bindings prevent counter devices from asserting individual bay state.
alter function private.ingest(uuid,uuid,bigint,int,timestamptz,boolean) rename to ingest_counter_validated;
create function private.ingest(p_device uuid,p_event uuid,p_sequence bigint,p_occupied int,p_observed timestamptz,p_simulated boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.iot_devices d join public.parking_zones z on z.id=d.zone_id where d.id=p_device and d.bay_id is null and z.kind='counter') then
   raise exception 'Device observation type mismatch' using errcode='22023'; end if;
 perform private.ingest_counter_validated(p_device,p_event,p_sequence,p_occupied,p_observed,p_simulated);
end$$;
revoke all on function private.ingest(uuid,uuid,bigint,int,timestamptz,boolean) from public,anon,authenticated;
create or replace function public.ingest_parking(p_device uuid,p_event uuid,p_sequence bigint,p_occupied int,p_observed timestamptz) returns void
language sql security definer set search_path='' as $$select private.ingest(p_device,p_event,p_sequence,p_occupied,p_observed,false)$$;

create function private.ingest_bay(p_device uuid,p_event uuid,p_sequence bigint,p_status text,p_observed timestamptz,p_simulated boolean) returns void language plpgsql security definer set search_path='' as $$
declare d public.iot_devices; b public.parking_bays;
begin
 select * into d from public.iot_devices where id=p_device for update;
 if d.id is null or not d.active then raise exception 'Device unavailable'; end if;
 select * into b from public.parking_bays where id=d.bay_id for update;
 if b.id is null then raise exception 'Device observation type mismatch' using errcode='22023'; end if;
 if p_event is null or p_sequence is null or p_sequence<=d.last_sequence or p_status is null or p_status not in ('FREE','OCCUPIED','UNKNOWN','OUT_OF_SERVICE')
   or p_observed is null or p_observed<now()-interval '2 minutes' or p_observed>now()+interval '30 seconds' or (b.observed_at is not null and p_observed<b.observed_at) then
   raise exception 'Invalid or replayed bay event'; end if;
 insert into public.iot_events(id,tenant_id,site_id,device_id,sequence,observed_at) values(p_event,d.tenant_id,d.site_id,d.id,p_sequence,p_observed);
 update public.iot_devices set last_sequence=p_sequence where id=d.id;
 update public.parking_bays set status=p_status,observed_at=p_observed,simulated=p_simulated where id=b.id;
end$$;
revoke all on function private.ingest_bay(uuid,uuid,bigint,text,timestamptz,boolean) from public,anon,authenticated;
create function public.ingest_parking_bay(p_device uuid,p_event uuid,p_sequence bigint,p_status text,p_observed timestamptz) returns void
language sql security definer set search_path='' as $$select private.ingest_bay(p_device,p_event,p_sequence,p_status,p_observed,false)$$;
revoke all on function public.ingest_parking_bay(uuid,uuid,bigint,text,timestamptz) from public,anon,authenticated;
grant execute on function public.ingest_parking_bay(uuid,uuid,bigint,text,timestamptz) to service_role;
create function public.simulate_parking_bay(p_device uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare d public.iot_devices;
begin
 select * into d from public.iot_devices where id=p_device for update;
 if not private.simulation_allowed(d.tenant_id) or not private.allowed(d.tenant_id,d.site_id,'parking.simulate') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.ingest_bay(d.id,gen_random_uuid(),d.last_sequence+1,p_status,now(),true);
 perform private.audit(d.tenant_id,d.site_id,'parking.bay.simulated',d.bay_id);
end$$;
revoke all on function public.simulate_parking_bay(uuid,text) from public,anon,authenticated;
grant execute on function public.simulate_parking_bay(uuid,text) to authenticated;

create function public.set_parking_override(p_zone uuid,p_occupied int,p_seconds int,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare z public.parking_zones;
begin
 select * into z from public.parking_zones where id=p_zone for update;
 if not private.allowed(z.tenant_id,z.site_id,'parking.update.manual') then raise exception 'Forbidden' using errcode='42501'; end if;
 if z.kind<>'counter' or p_occupied is null or p_occupied not between 0 and z.capacity or p_seconds is null or p_seconds not between 30 and 3600
 or p_reason is null or p_reason not in ('sensor_outage','verified_count','maintenance') then raise exception 'Invalid manual override' using errcode='22023'; end if;
 insert into private.parking_overrides(zone_id,tenant_id,site_id,occupied,reason,expires_at,actor)
 values(z.id,z.tenant_id,z.site_id,p_occupied,p_reason,now()+make_interval(secs=>p_seconds),auth.uid())
 on conflict(zone_id) do update set occupied=excluded.occupied,reason=excluded.reason,created_at=now(),expires_at=excluded.expires_at,actor=excluded.actor;
 insert into public.audit_events(tenant_id,site_id,actor,action,record_id,metadata)
 values(z.tenant_id,z.site_id,auth.uid(),'parking.manual.override',z.id,jsonb_build_object('reason',p_reason,'seconds',p_seconds,'occupied',p_occupied));
end$$;
revoke all on function public.set_parking_override(uuid,int,int,text) from public,anon,authenticated;
grant execute on function public.set_parking_override(uuid,int,int,text) to authenticated;

create function public.clear_parking_override(p_zone uuid) returns void language plpgsql security definer set search_path='' as $$
declare z public.parking_zones;
begin
 select * into z from public.parking_zones where id=p_zone for update;
 if not private.allowed(z.tenant_id,z.site_id,'parking.update.manual') then raise exception 'Forbidden' using errcode='42501'; end if;
 delete from private.parking_overrides where zone_id=z.id;
 perform private.audit(z.tenant_id,z.site_id,'parking.manual.cleared',z.id);
end$$;
revoke all on function public.clear_parking_override(uuid) from public,anon,authenticated;
grant execute on function public.clear_parking_override(uuid) to authenticated;

create function public.get_parking_overview(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; zones jsonb; devices jsonb:='[]'::jsonb;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(z)||jsonb_build_object('facility_name',f.name,'level_name',l.name,
 'override',case when o.expires_at>now() then jsonb_build_object('occupied',o.occupied,'observed_at',o.created_at,'expires_at',o.expires_at,'reason',o.reason) else null end,
 'bays',(select coalesce(jsonb_agg(jsonb_build_object('id',b.id,'label',b.label,'accessible',b.accessible,'status',b.status,'observed_at',b.observed_at,'simulated',b.simulated) order by b.label),'[]'::jsonb)
 from public.parking_bays b where b.zone_id=z.id)) order by z.name),'[]'::jsonb) into zones
 from public.parking_zones z left join public.parking_levels l on l.id=z.level_id left join public.parking_facilities f on f.id=l.facility_id
 left join private.parking_overrides o on o.zone_id=z.id where z.site_id=s.id;
 if private.allowed(s.tenant_id,s.id,'parking.configure') then
   select coalesce(jsonb_agg(jsonb_build_object('id',id,'zone_id',zone_id,'bay_id',bay_id,'active',active,'last_sequence',last_sequence)),'[]'::jsonb) into devices from public.iot_devices where site_id=s.id;
 end if;
 return jsonb_build_object('zones',zones,'devices',devices,
 'facilities',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from public.parking_facilities f where site_id=s.id),
 'levels',(select coalesce(jsonb_agg(to_jsonb(l)),'[]'::jsonb) from public.parking_levels l where site_id=s.id));
end$$;
revoke all on function public.get_parking_overview(uuid) from public,anon,authenticated;
grant execute on function public.get_parking_overview(uuid) to authenticated;
alter publication supabase_realtime add table public.parking_bays;

create or replace function public.deployment_health() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('tenants','sites','memberships','stops','audit_events','invitations','visits','parking_zones','iot_devices','iot_events','vehicles','rides','gps_observations','visitor_form_versions','visitor_form_responses','parking_facilities','parking_levels','parking_bays')),
 'unprotected',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'client_mutable',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
 'site_foreign_keys',(select count(*)=5 from pg_catalog.pg_constraint where conname in ('visit_invitation_site','event_device_site','pickup_service','destination_service','rides_tenant_id_site_id_vehicle_id_fkey') and contype='f'),
 'retention_scheduled',exists(select 1 from cron.job where jobname='smarttownship-retention' and active));
$$;

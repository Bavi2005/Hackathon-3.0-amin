create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public;

create table public.tenants(id uuid primary key default gen_random_uuid(), name text not null, demo boolean not null default false);
create table public.sites(id uuid primary key default gen_random_uuid(), tenant_id uuid not null references public.tenants, name text not null, unique(tenant_id,id));
create table public.memberships(id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null, user_id uuid not null references auth.users, role text not null check(role in ('RESIDENT','DRIVER','STAFF','SITE_MANAGER','TOWNSHIP_ADMIN','PLATFORM_OPERATOR')), capabilities text[] not null default '{}', active boolean not null default true, foreign key(tenant_id,site_id) references public.sites(tenant_id,id), unique(user_id,site_id));
create index on public.memberships(user_id,site_id) where active;
create table public.stops(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,name text not null,foreign key(tenant_id,site_id) references public.sites(tenant_id,id),unique(tenant_id,site_id,name));

create function private.allowed(t uuid,s uuid,c text default null) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.active and m.tenant_id=t and m.site_id=s and (c is null or c=any(m.capabilities)));
$$;
create function public.can(t uuid,s uuid,c text default null) returns boolean language sql stable security definer set search_path='' as $$select private.allowed(t,s,c)$$;

create table public.audit_events(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,actor uuid,action text not null,record_id uuid,created_at timestamptz not null default now(),foreign key(tenant_id,site_id) references public.sites(tenant_id,id));
create function private.audit(t uuid,s uuid,a text,r uuid) returns void language sql security definer set search_path='' as $$insert into public.audit_events(tenant_id,site_id,actor,action,record_id) values(t,s,auth.uid(),a,r)$$;

create table public.invitations(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,owner_id uuid not null references auth.users,token_hash text not null unique,expires_at timestamptz not null,redeemed_at timestamptz,created_at timestamptz not null default now(),foreign key(tenant_id,site_id) references public.sites(tenant_id,id));
create table public.visits(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,invitation_id uuid not null unique references public.invitations,owner_id uuid not null references auth.users,guest_name text not null check(length(guest_name) between 1 and 80),status text not null default 'pending_entry' check(status in ('pending_entry','onsite','departed')),created_at timestamptz not null default now(),entered_at timestamptz,exited_at timestamptz,foreign key(tenant_id,site_id) references public.sites(tenant_id,id));

create table public.parking_zones(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,name text not null,capacity int not null check(capacity>0),occupied int check(occupied>=0 and occupied<=capacity),observed_at timestamptz,simulated boolean not null default false,source text not null default 'counter' check(source in ('counter','manual')),foreign key(tenant_id,site_id) references public.sites(tenant_id,id),unique(tenant_id,site_id,id));
create table public.iot_devices(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,zone_id uuid not null,active boolean not null default true,last_sequence bigint not null default -1,foreign key(tenant_id,site_id,zone_id) references public.parking_zones(tenant_id,site_id,id));
create table public.iot_events(id uuid primary key,tenant_id uuid not null,site_id uuid not null,device_id uuid not null references public.iot_devices,sequence bigint not null,observed_at timestamptz not null,created_at timestamptz not null default now(),unique(device_id,sequence),foreign key(tenant_id,site_id) references public.sites(tenant_id,id));

create table public.vehicles(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,name text not null,capacity int not null check(capacity>0),accessible boolean not null default false,driver_id uuid references auth.users,shift_active boolean not null default false,lat double precision check(lat between -90 and 90),lng double precision check(lng between -180 and 180),accuracy double precision check(accuracy between 0 and 10000),observed_at timestamptz,simulated boolean not null default false,foreign key(tenant_id,site_id) references public.sites(tenant_id,id),unique(tenant_id,site_id,id));
create unique index one_active_shift on public.vehicles(driver_id) where shift_active;
create table public.rides(id uuid primary key,tenant_id uuid not null,site_id uuid not null,resident_id uuid not null references auth.users,vehicle_id uuid,pickup text not null check(length(pickup) between 1 and 100),destination text not null check(length(destination) between 1 and 100),accessible boolean not null default false,status text not null default 'requested' check(status in ('requested','assigned','boarded','completed','cancelled')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),foreign key(tenant_id,site_id) references public.sites(tenant_id,id),foreign key(tenant_id,site_id,vehicle_id) references public.vehicles(tenant_id,site_id,id));
create index on public.rides(vehicle_id,status);
create table public.gps_observations(id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,vehicle_id uuid not null,lat double precision not null check(lat between -90 and 90),lng double precision not null check(lng between -180 and 180),accuracy double precision not null check(accuracy between 0 and 10000),observed_at timestamptz not null,simulated boolean not null,foreign key(tenant_id,site_id,vehicle_id) references public.vehicles(tenant_id,site_id,id));
create index on public.gps_observations(observed_at);

-- RLS is mandatory even for tables whose mutations are RPC-only.
do $$declare n text;begin
 foreach n in array array['tenants','sites','memberships','stops','audit_events','invitations','visits','parking_zones','iot_devices','iot_events','vehicles','rides','gps_observations'] loop
 execute format('alter table public.%I enable row level security',n);
 execute format('revoke all on public.%I from anon, authenticated',n);
 execute format('grant select on public.%I to authenticated',n);
 end loop;
end$$;
create policy tenants_read on public.tenants for select to authenticated using(exists(select 1 from public.memberships m where m.tenant_id=tenants.id and m.user_id=auth.uid() and m.active));
create policy sites_read on public.sites for select to authenticated using(private.allowed(tenant_id,id));
create policy stops_read on public.stops for select to authenticated using(private.allowed(tenant_id,site_id));
create policy membership_self on public.memberships for select to authenticated using(user_id=auth.uid() and active);
create policy audit_read on public.audit_events for select to authenticated using(private.allowed(tenant_id,site_id,'audit.read'));
create policy invitations_read on public.invitations for select to authenticated using(owner_id=auth.uid() and private.allowed(tenant_id,site_id));
create policy visits_read on public.visits for select to authenticated using(private.allowed(tenant_id,site_id) and (owner_id=auth.uid() or private.allowed(tenant_id,site_id,'visits.read.site')));
create policy parking_read on public.parking_zones for select to authenticated using(private.allowed(tenant_id,site_id));
create policy devices_read on public.iot_devices for select to authenticated using(private.allowed(tenant_id,site_id,'parking.configure'));
create policy events_read on public.iot_events for select to authenticated using(private.allowed(tenant_id,site_id,'parking.configure'));
-- Locations are disclosed only to own active riders, assigned driver or dispatcher.
create function private.drives(v uuid) returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.vehicles where id=v and driver_id=auth.uid())$$;
create policy vehicles_read on public.vehicles for select to authenticated using(private.allowed(tenant_id,site_id) and (driver_id=auth.uid() or private.allowed(tenant_id,site_id,'fleet.dispatch') or exists(select 1 from public.rides r where r.vehicle_id=vehicles.id and r.resident_id=auth.uid() and r.status in ('assigned','boarded'))));
create policy rides_read on public.rides for select to authenticated using(private.allowed(tenant_id,site_id) and (resident_id=auth.uid() or private.allowed(tenant_id,site_id,'fleet.dispatch') or (private.allowed(tenant_id,site_id,'fleet.drive') and private.drives(vehicle_id))));
create policy gps_read on public.gps_observations for select to authenticated using(private.allowed(tenant_id,site_id,'fleet.dispatch'));

-- Helpers are inaccessible through PostgREST; policy helper execution needs schema access.
grant usage on schema private to authenticated;
grant execute on function private.allowed(uuid,uuid,text) to authenticated;
revoke all on function private.audit(uuid,uuid,text,uuid) from public;

create function public.create_invitation(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; tok text; ident uuid;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id,'visits.invite') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.memberships where user_id=auth.uid() and site_id=p_site for update;
 if (select count(*) from public.invitations where owner_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation rate limit'; end if;
 tok:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.invitations(tenant_id,site_id,owner_id,token_hash,expires_at) values(s.tenant_id,s.id,auth.uid(),encode(extensions.digest(tok,'sha256'),'hex'),now()+interval '24 hours') returning id into ident;
 perform private.audit(s.tenant_id,s.id,'invitation.created',ident);
 return jsonb_build_object('id',ident,'token',tok,'expires_at',now()+interval '24 hours');
end$$;
create function public.redeem_invitation(p_token text,p_name text,p_consent boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; ident uuid;
begin
 if length(p_token)<>64 or length(trim(p_name)) not between 1 and 80 or p_consent is distinct from true then raise exception 'Invalid registration'; end if;
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.expires_at<=now() or i.redeemed_at is not null then raise exception 'Invitation unavailable'; end if;
 insert into public.visits(tenant_id,site_id,invitation_id,owner_id,guest_name) values(i.tenant_id,i.site_id,i.id,i.owner_id,trim(p_name)) returning id into ident;
 update public.invitations set redeemed_at=now() where id=i.id;
 perform private.audit(i.tenant_id,i.site_id,'visitor.registered.notice-v1',ident);
 return ident;
end$$;
create function public.visit_transition(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 select * into v from public.visits where id=p_id for update;
 if not private.allowed(v.tenant_id,v.site_id,'visits.checkin') then raise exception 'Forbidden' using errcode='42501';end if;
 if not ((v.status='pending_entry' and p_status='onsite') or (v.status='onsite' and p_status='departed')) then raise exception 'Invalid transition';end if;
 update public.visits set status=p_status,entered_at=case when p_status='onsite' then now() else entered_at end,exited_at=case when p_status='departed' then now() else null end where id=p_id;
 perform private.audit(v.tenant_id,v.site_id,'visit.'||p_status,p_id);
end$$;

create function public.request_ride(p_id uuid,p_site uuid,p_pickup text,p_destination text,p_accessible boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sites;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id,'rides.request') then raise exception 'Forbidden' using errcode='42501';end if;
 if p_pickup is null or p_destination is null or p_pickup=p_destination or not exists(select 1 from public.stops where tenant_id=s.tenant_id and site_id=s.id and name=p_pickup) or not exists(select 1 from public.stops where tenant_id=s.tenant_id and site_id=s.id and name=p_destination) then raise exception 'Choose two configured service stops';end if;
 perform 1 from public.memberships where user_id=auth.uid() and site_id=p_site for update;
 if exists(select 1 from public.rides where id=p_id and resident_id=auth.uid() and site_id=p_site) then return p_id;end if;
 if (select count(*) from public.rides where resident_id=auth.uid() and status in ('requested','assigned','boarded'))>=3 then raise exception 'Active ride limit';end if;
 insert into public.rides(id,tenant_id,site_id,resident_id,pickup,destination,accessible) values(p_id,s.tenant_id,s.id,auth.uid(),trim(p_pickup),trim(p_destination),p_accessible);
 perform private.audit(s.tenant_id,s.id,'ride.requested',p_id);return p_id;
end$$;
create function public.assign_ride(p_ride uuid,p_vehicle uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.rides; v public.vehicles;
begin
 -- Always lock vehicle before ride; serializes occupancy check for this vehicle.
 select * into v from public.vehicles where id=p_vehicle for update;
 if not private.allowed(v.tenant_id,v.site_id,'fleet.dispatch') then raise exception 'Forbidden' using errcode='42501';end if;
 select * into r from public.rides where id=p_ride for update;
 if r.vehicle_id=v.id and r.status='assigned' then return;end if;
 if r.id is null or r.tenant_id<>v.tenant_id or r.site_id<>v.site_id or r.status<>'requested' or not v.shift_active or (r.accessible and not v.accessible) then raise exception 'Incompatible assignment';end if;
 if (select count(*) from public.rides where vehicle_id=v.id and status in ('assigned','boarded'))>=v.capacity then raise exception 'Vehicle full';end if;
 update public.rides set vehicle_id=v.id,status='assigned',updated_at=now() where id=r.id;
 perform private.audit(r.tenant_id,r.site_id,'dispatch.manual.capacity-checked',r.id);
end$$;
create function public.ride_transition(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.rides; v public.vehicles;
begin
 select * into r from public.rides where id=p_id for update;
 if not private.allowed(r.tenant_id,r.site_id) then raise exception 'Forbidden' using errcode='42501';end if;
 select * into v from public.vehicles where id=r.vehicle_id;
 if p_status='cancelled' and r.resident_id=auth.uid() and r.status in ('requested','assigned') then null;
 elsif v.driver_id=auth.uid() and v.shift_active and private.allowed(r.tenant_id,r.site_id,'fleet.drive') and ((r.status='assigned' and p_status='boarded') or (r.status='boarded' and p_status='completed')) then null;
 else raise exception 'Forbidden transition' using errcode='42501';end if;
 update public.rides set status=p_status,updated_at=now() where id=r.id;
 perform private.audit(r.tenant_id,r.site_id,'ride.'||p_status,r.id);
end$$;
create function public.set_shift(p_vehicle uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if v.driver_id is distinct from auth.uid() or not private.allowed(v.tenant_id,v.site_id,'fleet.drive') then raise exception 'Forbidden' using errcode='42501';end if;
 if p_active is false and exists(select 1 from public.rides where vehicle_id=v.id and status in ('assigned','boarded')) then raise exception 'Complete active rides first';end if;
 update public.vehicles set shift_active=p_active,lat=null,lng=null,observed_at=null where id=v.id;
 perform private.audit(v.tenant_id,v.site_id,'shift.'||p_active::text,v.id);
end$$;
create function public.telemetry(p_vehicle uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_observed timestamptz,p_simulated boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles; demo boolean;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 select t.demo into demo from public.tenants t where t.id=v.tenant_id;
 if v.driver_id is distinct from auth.uid() or not v.shift_active or not private.allowed(v.tenant_id,v.site_id,'fleet.drive') or (p_simulated and not demo) then raise exception 'Forbidden' using errcode='42501';end if;
 if p_observed is null or p_observed<now()-interval '2 minutes' or p_observed>now()+interval '30 seconds' or (v.observed_at is not null and p_observed<=v.observed_at+interval '4 seconds') or p_lat is null or p_lng is null or p_accuracy is null then raise exception 'Invalid or throttled telemetry';end if;
 update public.vehicles set lat=p_lat,lng=p_lng,accuracy=p_accuracy,observed_at=p_observed,simulated=p_simulated where id=v.id;
 insert into public.gps_observations(tenant_id,site_id,vehicle_id,lat,lng,accuracy,observed_at,simulated) values(v.tenant_id,v.site_id,v.id,p_lat,p_lng,p_accuracy,p_observed,p_simulated);
end$$;

create function private.ingest(p_device uuid,p_event uuid,p_sequence bigint,p_occupied int,p_observed timestamptz,p_simulated boolean) returns void language plpgsql security definer set search_path='' as $$
declare d public.iot_devices;z public.parking_zones;
begin
 select * into d from public.iot_devices where id=p_device for update;
 if d.id is null or not d.active then raise exception 'Device unavailable';end if;
 select * into z from public.parking_zones where id=d.zone_id for update;
 if p_sequence is null or p_sequence<=d.last_sequence or p_observed is null or p_observed<now()-interval '2 minutes' or p_observed>now()+interval '30 seconds' or (z.observed_at is not null and p_observed<z.observed_at) or p_occupied is null or p_occupied<0 or p_occupied>z.capacity then raise exception 'Invalid or replayed event';end if;
 insert into public.iot_events(id,tenant_id,site_id,device_id,sequence,observed_at) values(p_event,d.tenant_id,d.site_id,d.id,p_sequence,p_observed);
 update public.iot_devices set last_sequence=p_sequence where id=d.id;
 update public.parking_zones set occupied=p_occupied,observed_at=p_observed,simulated=p_simulated,source='counter' where id=z.id;
end$$;
revoke all on function private.ingest(uuid,uuid,bigint,int,timestamptz,boolean) from public;
create function public.ingest_parking(p_device uuid,p_event uuid,p_sequence bigint,p_occupied int,p_observed timestamptz) returns void language sql security definer set search_path='' as $$select private.ingest(p_device,p_event,p_sequence,p_occupied,p_observed,false)$$;
create function public.simulate_parking(p_device uuid,p_occupied int) returns void language plpgsql security definer set search_path='' as $$
declare d public.iot_devices;demo boolean;
begin
 select * into d from public.iot_devices where id=p_device for update;
 select t.demo into demo from public.tenants t where t.id=d.tenant_id;
 if not coalesce(demo,false) or not private.allowed(d.tenant_id,d.site_id,'parking.simulate') then raise exception 'Forbidden' using errcode='42501';end if;
 perform private.ingest(d.id,gen_random_uuid(),d.last_sequence+1,p_occupied,now(),true);
 perform private.audit(d.tenant_id,d.site_id,'parking.simulated',d.zone_id);
end$$;

-- Explicit function privileges: Postgres otherwise grants PUBLIC execute by default.
do $$declare f record;begin
 for f in select p.oid::regprocedure as sig,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('can','create_invitation','redeem_invitation','visit_transition','request_ride','assign_ride','ride_transition','set_shift','telemetry','ingest_parking','simulate_parking') loop
 execute format('revoke all on function %s from public, anon, authenticated',f.sig);
 if f.proname<>'ingest_parking' then execute format('grant execute on function %s to authenticated',f.sig);end if;
 end loop;
end$$;
grant execute on function public.redeem_invitation(text,text,boolean) to anon;
grant execute on function public.ingest_parking(uuid,uuid,bigint,int,timestamptz) to service_role;

alter publication supabase_realtime add table public.visits,public.parking_zones,public.vehicles,public.rides;

-- Storage is private, scoped to tenant/site/user paths. No visitor documents by default.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('private-assets','private-assets',false,2097152,array['image/png','image/jpeg']) on conflict(id) do nothing;
create policy assets_read on storage.objects for select to authenticated using(bucket_id='private-assets' and (storage.foldername(name))[3]=auth.uid()::text and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.active and m.tenant_id::text=(storage.foldername(name))[1] and m.site_id::text=(storage.foldername(name))[2]));
create policy assets_insert on storage.objects for insert to authenticated with check(bucket_id='private-assets' and (storage.foldername(name))[3]=auth.uid()::text and exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.active and m.tenant_id::text=(storage.foldername(name))[1] and m.site_id::text=(storage.foldername(name))[2]));

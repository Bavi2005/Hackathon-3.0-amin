-- Delegated administration is site-scoped. No implicit platform-wide authority.
alter table public.memberships add column revision int not null default 1;
alter table public.vehicles add column revision int not null default 1;
alter table public.parking_zones add column revision int not null default 1;
alter table public.iot_devices add column revision int not null default 1;

create function private.require_step_up(p_tenant uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.simulation_allowed(p_tenant) and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
   raise exception 'Multi-factor step-up required' using errcode='42501'; end if;
end$$;
revoke all on function private.require_step_up(uuid) from public,anon,authenticated;
create function private.staff_capabilities(p_template text) returns text[] language sql immutable set search_path='' as $$
 select case p_template
 when 'guard' then array['visits.read.site','visits.checkin','visits.assist']
 when 'parking' then array['parking.configure','parking.update.manual']
 when 'dispatcher' then array['fleet.dispatch']
 when 'driver' then array['fleet.drive'] else null end
$$;
revoke all on function private.staff_capabilities(text) from public,anon,authenticated;
create table private.staff_invitations(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,
 target_user uuid not null,template text not null check(template in ('guard','parking','dispatcher','driver')),
 token_hash text unique not null,request_id uuid not null,created_by uuid not null references auth.users,
 expires_at timestamptz not null,created_at timestamptz not null default now(),accepted_at timestamptz,revoked_at timestamptz,
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id),unique(site_id,request_id)
);
alter table private.staff_invitations enable row level security;
revoke all on private.staff_invitations from public,anon,authenticated;

create function public.get_site_administration(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; result jsonb;
begin
 select * into s from public.sites where id=p_site;
 if not (private.allowed(s.tenant_id,s.id,'staff.manage') or private.allowed(s.tenant_id,s.id,'fleet.configure') or private.allowed(s.tenant_id,s.id,'parking.configure')) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 result:=jsonb_build_object('members', '[]'::jsonb,'invitations','[]'::jsonb,'vehicles','[]'::jsonb,'zones','[]'::jsonb,'devices','[]'::jsonb,'stops','[]'::jsonb);
 if private.allowed(s.tenant_id,s.id,'staff.manage') then
   result:=result||jsonb_build_object('members',(select coalesce(jsonb_agg(to_jsonb(m)),'[]'::jsonb) from
     (select id,user_id,role,capabilities,active,revision from public.memberships where site_id=s.id order by id limit 200) m),
   'invitations',(select coalesce(jsonb_agg(to_jsonb(i)),'[]'::jsonb) from
     (select id,target_user,template,expires_at,accepted_at,revoked_at from private.staff_invitations where site_id=s.id order by created_at desc limit 100) i));
   perform private.audit(s.tenant_id,s.id,'staff.directory.read',s.id);
 end if;
 if private.allowed(s.tenant_id,s.id,'fleet.configure') then
   result:=result||jsonb_build_object('vehicles',(select coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) from
     (select id,name,capacity,accessible,driver_id,shift_active,revision from public.vehicles where site_id=s.id order by name limit 200) v),
   'stops',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from (select id,name from public.stops where site_id=s.id order by name limit 200) p));
 end if;
 if private.allowed(s.tenant_id,s.id,'parking.configure') then
   result:=result||jsonb_build_object('zones',(select coalesce(jsonb_agg(to_jsonb(z)),'[]'::jsonb) from
     (select id,name,capacity,occupied,revision from public.parking_zones where site_id=s.id order by name limit 200) z),
   'devices',(select coalesce(jsonb_agg(to_jsonb(d)),'[]'::jsonb) from
     (select id,zone_id,active,last_sequence,revision from public.iot_devices where site_id=s.id order by id limit 200) d));
 end if;
 return result;
end$$;
revoke all on function public.get_site_administration(uuid) from public,anon,authenticated;
grant execute on function public.get_site_administration(uuid) to authenticated;

create function public.invite_site_staff(p_site uuid,p_request uuid,p_user uuid,p_template text) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; existing private.staff_invitations; ident uuid; token text;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'staff.invite') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(s.tenant_id);
 if p_request is null or p_user is null or p_user=auth.uid() or private.staff_capabilities(p_template) is null then raise exception 'Invalid staff invitation' using errcode='22023'; end if;
 select * into existing from private.staff_invitations where site_id=s.id and request_id=p_request;
 if found then
   if existing.created_by<>auth.uid() or existing.target_user<>p_user or existing.template<>p_template then raise exception 'Invitation request conflict' using errcode='22023'; end if;
   return jsonb_build_object('id',existing.id,'token',null,'expires_at',existing.expires_at,'replayed',true);
 end if;
 if exists(select 1 from public.memberships where site_id=s.id and user_id=p_user) then raise exception 'Membership already exists; use membership controls' using errcode='22023'; end if;
 if (select count(*) from private.staff_invitations where created_by=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Staff invitation rate limit'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.staff_invitations(tenant_id,site_id,target_user,template,token_hash,request_id,created_by,expires_at)
 values(s.tenant_id,s.id,p_user,p_template,encode(extensions.digest(token,'sha256'),'hex'),p_request,auth.uid(),now()+interval '24 hours') returning id into ident;
 perform private.audit(s.tenant_id,s.id,'staff.invited.'||p_template,ident);
 return jsonb_build_object('id',ident,'token',token,'expires_at',now()+interval '24 hours','replayed',false);
end$$;
revoke all on function public.invite_site_staff(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.invite_site_staff(uuid,uuid,uuid,text) to authenticated;

create function public.accept_staff_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i private.staff_invitations; ident uuid;
begin
 select * into i from private.staff_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 perform 1 from public.sites where id=i.site_id for share;
 select * into i from private.staff_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.target_user is distinct from auth.uid() or i.expires_at<=now() or i.revoked_at is not null or i.accepted_at is not null then
   raise exception 'Staff invitation unavailable' using errcode='42501'; end if;
 -- Revoking the issuer's delegation also invalidates their outstanding invitations.
 if not exists(select 1 from public.memberships where user_id=i.created_by and site_id=i.site_id and active and 'staff.invite'=any(capabilities)) then
   raise exception 'Staff invitation unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid() and site_id=i.site_id) then raise exception 'Membership already exists' using errcode='22023'; end if;
 insert into public.memberships(tenant_id,site_id,user_id,role,capabilities)
 values(i.tenant_id,i.site_id,auth.uid(),case when i.template='driver' then 'DRIVER' else 'STAFF' end,private.staff_capabilities(i.template)) returning id into ident;
 update private.staff_invitations set accepted_at=now() where id=i.id;
 perform private.audit(i.tenant_id,i.site_id,'staff.invitation.accepted',ident);
 return ident;
end$$;
revoke all on function public.accept_staff_invitation(text) from public,anon,authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;

create function public.revoke_staff_invitation(p_site uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare i private.staff_invitations;
begin
 select * into i from private.staff_invitations where id=p_id and site_id=p_site for update;
 if not private.allowed(i.tenant_id,i.site_id,'staff.invite') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(i.tenant_id);
 if i.accepted_at is not null then raise exception 'Invitation already accepted; use membership controls' using errcode='22023'; end if;
 if i.revoked_at is not null then return; end if;
 update private.staff_invitations set revoked_at=now() where id=i.id;
 perform private.audit(i.tenant_id,i.site_id,'staff.invitation.revoked',i.id);
end$$;
revoke all on function public.revoke_staff_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_staff_invitation(uuid,uuid) to authenticated;

create function public.set_staff_membership(p_site uuid,p_id uuid,p_expected int,p_template text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare m public.memberships; s public.sites;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'staff.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(s.tenant_id);
 select * into m from public.memberships where id=p_id and site_id=s.id for update;
 if m.id is null or m.user_id=auth.uid() or m.role not in ('STAFF','DRIVER') then raise exception 'Only other delegated staff memberships can be changed' using errcode='42501'; end if;
 if m.revision is distinct from p_expected then raise exception 'Membership changed; reload before saving' using errcode='22023'; end if;
 if p_active is null or private.staff_capabilities(p_template) is null then raise exception 'Invalid staff assignment' using errcode='22023'; end if;
 if exists(select 1 from public.vehicles where driver_id=m.user_id and site_id=s.id and shift_active) then raise exception 'End assigned shifts before changing this membership' using errcode='22023'; end if;
 update public.memberships set role=case when p_template='driver' then 'DRIVER' else 'STAFF' end,capabilities=private.staff_capabilities(p_template),active=p_active,revision=revision+1 where id=m.id;
 perform private.audit(s.tenant_id,s.id,'staff.membership.'||case when p_active then 'updated' else 'disabled' end,m.id);
end$$;
revoke all on function public.set_staff_membership(uuid,uuid,int,text,boolean) from public,anon,authenticated;
grant execute on function public.set_staff_membership(uuid,uuid,int,text,boolean) to authenticated;

create function public.save_site_vehicle(p_site uuid,p_id uuid,p_expected int,p_name text,p_capacity int,p_accessible boolean,p_driver uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sites; v public.vehicles;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'fleet.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 80 or p_capacity is null or p_capacity not between 1 and 100 or p_accessible is null then raise exception 'Invalid vehicle' using errcode='22023'; end if;
 if p_driver is not null and not exists(select 1 from public.memberships where user_id=p_driver and site_id=s.id and active and 'fleet.drive'=any(capabilities)) then raise exception 'Driver must have active driving capability at this site' using errcode='22023'; end if;
 select * into v from public.vehicles where id=p_id for update;
 if v.id is not null and v.site_id<>s.id then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_expected=0 and v.revision=1 and v.name=btrim(p_name) and v.capacity=p_capacity and v.accessible=p_accessible and v.driver_id is not distinct from p_driver then return v.id; end if;
 if coalesce(v.revision,0) is distinct from p_expected then raise exception 'Vehicle changed; reload before saving' using errcode='22023'; end if;
 if v.shift_active or exists(select 1 from public.rides where vehicle_id=v.id and status in ('assigned','boarded')) then raise exception 'End active shifts and rides before editing vehicle' using errcode='22023'; end if;
 if v.id is null then
   insert into public.vehicles(id,tenant_id,site_id,name,capacity,accessible,driver_id) values(p_id,s.tenant_id,s.id,btrim(p_name),p_capacity,p_accessible,p_driver);
 else
   update public.vehicles set name=btrim(p_name),capacity=p_capacity,accessible=p_accessible,driver_id=p_driver,revision=revision+1 where id=v.id;
 end if;
 perform private.audit(s.tenant_id,s.id,'fleet.vehicle.saved',p_id); return p_id;
end$$;
revoke all on function public.save_site_vehicle(uuid,uuid,int,text,int,boolean,uuid) from public,anon,authenticated;
grant execute on function public.save_site_vehicle(uuid,uuid,int,text,int,boolean,uuid) to authenticated;

create function public.add_site_stop(p_site uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sites; ident uuid;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'fleet.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_name is null or length(btrim(p_name)) not between 1 and 100 then raise exception 'Invalid stop name' using errcode='22023'; end if;
 if (select count(*) from public.stops where site_id=s.id)>=200 then raise exception 'Site stop limit reached'; end if;
 insert into public.stops(tenant_id,site_id,name) values(s.tenant_id,s.id,btrim(p_name)) returning id into ident;
 perform private.audit(s.tenant_id,s.id,'fleet.stop.created',ident); return ident;
end$$;
revoke all on function public.add_site_stop(uuid,text) from public,anon,authenticated;
grant execute on function public.add_site_stop(uuid,text) to authenticated;

create function public.save_parking_zone(p_site uuid,p_id uuid,p_expected int,p_name text,p_capacity int) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sites; z public.parking_zones;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'parking.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 100 or p_capacity is null or p_capacity not between 1 and 100000 then raise exception 'Invalid parking zone' using errcode='22023'; end if;
 select * into z from public.parking_zones where id=p_id for update;
 if z.id is not null and z.site_id<>s.id then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_expected=0 and z.revision=1 and z.name=btrim(p_name) and z.capacity=p_capacity then return z.id; end if;
 if coalesce(z.revision,0) is distinct from p_expected then raise exception 'Parking zone changed; reload before saving' using errcode='22023'; end if;
 if z.occupied>p_capacity then raise exception 'Capacity cannot be below observed occupancy' using errcode='22023'; end if;
 if z.id is null then
   insert into public.parking_zones(id,tenant_id,site_id,name,capacity) values(p_id,s.tenant_id,s.id,btrim(p_name),p_capacity);
 else update public.parking_zones set name=btrim(p_name),capacity=p_capacity,revision=revision+1 where id=z.id; end if;
 perform private.audit(s.tenant_id,s.id,'parking.zone.saved',p_id); return p_id;
end$$;
revoke all on function public.save_parking_zone(uuid,uuid,int,text,int) from public,anon,authenticated;
grant execute on function public.save_parking_zone(uuid,uuid,int,text,int) to authenticated;

create function public.save_parking_device(p_site uuid,p_id uuid,p_expected int,p_zone uuid,p_active boolean) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sites; d public.iot_devices;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'parking.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_active is null or not exists(select 1 from public.parking_zones where id=p_zone and site_id=s.id) then raise exception 'Invalid parking device or zone' using errcode='22023'; end if;
 select * into d from public.iot_devices where id=p_id for update;
 if d.id is not null and d.site_id<>s.id then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_expected=0 and d.revision=1 and d.zone_id=p_zone and d.active=p_active then return d.id; end if;
 if coalesce(d.revision,0) is distinct from p_expected then raise exception 'Device changed; reload before saving' using errcode='22023'; end if;
 if d.id is null then
   -- A device registry record supplies no signing credentials or physical connection.
   insert into public.iot_devices(id,tenant_id,site_id,zone_id,active) values(p_id,s.tenant_id,s.id,p_zone,p_active);
 else
   if d.zone_id<>p_zone then raise exception 'Retire the old device and provision a new identifier to change zones' using errcode='22023'; end if;
   update public.iot_devices set active=p_active,revision=revision+1 where id=d.id;
 end if;
 perform private.audit(s.tenant_id,s.id,'parking.device.saved',p_id); return p_id;
end$$;
revoke all on function public.save_parking_device(uuid,uuid,int,uuid,boolean) from public,anon,authenticated;
grant execute on function public.save_parking_device(uuid,uuid,int,uuid,boolean) to authenticated;

-- Serialize shift starts with site membership/vehicle configuration changes.
alter function public.set_shift(uuid,boolean) rename to set_shift_validated;
alter function public.set_shift_validated(uuid,boolean) set schema private;
revoke all on function private.set_shift_validated(uuid,boolean) from public,anon,authenticated;
create function public.set_shift(p_vehicle uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.sites where id=(select site_id from public.vehicles where id=p_vehicle) for share;
 perform private.set_shift_validated(p_vehicle,p_active);
end$$;
revoke all on function public.set_shift(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_shift(uuid,boolean) to authenticated;

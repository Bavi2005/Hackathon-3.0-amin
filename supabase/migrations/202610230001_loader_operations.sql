-- Mall goods-loading desk: site-scoped access, server timestamps and audited exports.
-- No real sensor or GPS claims. Invited loaders cannot manage other staff.
alter table public.memberships drop constraint if exists memberships_role_check;
alter table public.memberships add constraint memberships_role_check check(role in ('RESIDENT','DRIVER','STAFF','SITE_MANAGER','TOWNSHIP_ADMIN','PLATFORM_OPERATOR','LOADER'));
alter table private.staff_invitations drop constraint if exists staff_invitations_template_check;
alter table private.staff_invitations add constraint staff_invitations_template_check check(template in ('guard','parking','dispatcher','driver','loader'));

create or replace function private.staff_capabilities(p_template text) returns text[]
language sql immutable set search_path='' as $$
 select case p_template
 when 'guard' then array['visits.read.site','visits.checkin','visits.assist']
 when 'parking' then array['parking.configure','parking.update.manual']
 when 'dispatcher' then array['fleet.dispatch']
 when 'driver' then array['fleet.drive']
 when 'loader' then array['loading.manage']
 else null end
$$;
revoke all on function private.staff_capabilities(text) from public,anon,authenticated;

-- Replace old acceptance functions with the same security invariants, adding a distinct LOADER role.
create or replace function public.accept_staff_invitation(p_token text) returns uuid language plpgsql security definer set search_path='' as $$
declare i private.staff_invitations; ident uuid;
begin
 if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'Staff invitation unavailable' using errcode='42501'; end if;
 select * into i from private.staff_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 perform 1 from public.sites where id=i.site_id for share;
 select * into i from private.staff_invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.target_user is distinct from auth.uid() or i.expires_at<=now() or i.revoked_at is not null or i.accepted_at is not null then
   raise exception 'Staff invitation unavailable' using errcode='42501'; end if;
 if not exists(select 1 from public.memberships where user_id=i.created_by and site_id=i.site_id and active and 'staff.invite'=any(capabilities)) then
   raise exception 'Staff invitation unavailable' using errcode='42501'; end if;
 if exists(select 1 from public.memberships where user_id=auth.uid() and site_id=i.site_id) then raise exception 'Membership already exists' using errcode='22023'; end if;
 insert into public.memberships(tenant_id,site_id,user_id,role,capabilities)
 values(i.tenant_id,i.site_id,auth.uid(),case when i.template='driver' then 'DRIVER' when i.template='loader' then 'LOADER' else 'STAFF' end,private.staff_capabilities(i.template)) returning id into ident;
 update private.staff_invitations set accepted_at=now() where id=i.id;
 perform private.audit(i.tenant_id,i.site_id,'staff.invitation.accepted',ident);
 return ident;
end$$;
revoke all on function public.accept_staff_invitation(text) from public,anon,authenticated;
grant execute on function public.accept_staff_invitation(text) to authenticated;

create or replace function public.set_staff_membership(p_site uuid,p_id uuid,p_expected int,p_template text,p_active boolean) returns void
language plpgsql security definer set search_path='' as $$
declare m public.memberships; s public.sites;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'staff.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(s.tenant_id);
 select * into m from public.memberships where id=p_id and site_id=s.id for update;
 if m.id is null or m.user_id=auth.uid() or m.role not in ('STAFF','DRIVER','LOADER') then raise exception 'Only other delegated staff memberships can be changed' using errcode='42501'; end if;
 if m.revision is distinct from p_expected then raise exception 'Membership changed; reload before saving' using errcode='22023'; end if;
 if p_active is null or private.staff_capabilities(p_template) is null then raise exception 'Invalid staff assignment' using errcode='22023'; end if;
 if exists(select 1 from public.vehicles where driver_id=m.user_id and site_id=s.id and shift_active) then raise exception 'End assigned shifts before changing this membership' using errcode='22023'; end if;
 update public.memberships set role=case when p_template='driver' then 'DRIVER' when p_template='loader' then 'LOADER' else 'STAFF' end,
   capabilities=private.staff_capabilities(p_template),active=p_active,revision=revision+1 where id=m.id;
 perform private.audit(s.tenant_id,s.id,'staff.membership.'||case when p_active then 'updated' else 'disabled' end,m.id);
end$$;
revoke all on function public.set_staff_membership(uuid,uuid,int,text,boolean) from public,anon,authenticated;
grant execute on function public.set_staff_membership(uuid,uuid,int,text,boolean) to authenticated;

create table private.loading_sessions(
 id uuid primary key, tenant_id uuid not null,site_id uuid not null,
 facility_id uuid not null,level_id uuid not null,
 vehicle_ref text not null check(length(btrim(vehicle_ref)) between 2 and 32),
 delivery_ref text not null check(length(btrim(delivery_ref)) between 2 and 80),
 status text not null default 'loading' check(status in ('loading','departed')),
 created_by uuid not null references auth.users,
 checked_in_at timestamptz not null default now(),
 checked_out_at timestamptz,
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id),
 foreign key(tenant_id,site_id,facility_id) references public.parking_facilities(tenant_id,site_id,id),
 foreign key(tenant_id,site_id,level_id) references public.parking_levels(tenant_id,site_id,id),
 check ((status='departed')=(checked_out_at is not null))
);
create index loading_sessions_site_time on private.loading_sessions(site_id,checked_in_at desc);
alter table private.loading_sessions enable row level security;
revoke all on private.loading_sessions from public,anon,authenticated;

create function private.loading_allowed(p_tenant uuid,p_site uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select private.allowed(p_tenant,p_site,'loading.manage') or exists(
   select 1 from public.memberships m where m.user_id=auth.uid() and m.active
   and m.tenant_id=p_tenant and m.site_id=p_site and m.role in ('SITE_MANAGER','TOWNSHIP_ADMIN')
 )
$$;
revoke all on function private.loading_allowed(uuid,uuid) from public,anon,authenticated;

create function public.get_loading_dashboard(p_site uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.sites; rows jsonb;
begin
 select * into s from public.sites where id=p_site;
 if s.id is null or not private.loading_allowed(s.tenant_id,s.id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.checked_in_at desc),'[]'::jsonb) into rows from (
  select l.id,l.facility_id,l.level_id,l.vehicle_ref,l.delivery_ref,l.status,l.checked_in_at,l.checked_out_at,
         f.name facility_name,p.name level_name
  from private.loading_sessions l
  join public.parking_facilities f on f.id=l.facility_id
  join public.parking_levels p on p.id=l.level_id
  where l.site_id=s.id order by l.checked_in_at desc limit 100
 ) x;
 return jsonb_build_object('sessions',rows,'active',(select count(*) from private.loading_sessions where site_id=s.id and status='loading'),
   'today',(select count(*) from private.loading_sessions where site_id=s.id and checked_in_at>=date_trunc('day',now() at time zone 'Asia/Kuala_Lumpur') at time zone 'Asia/Kuala_Lumpur'),
   'departed',(select count(*) from private.loading_sessions where site_id=s.id and status='departed'),
   'server_time',now());
end$$;
revoke all on function public.get_loading_dashboard(uuid) from public,anon,authenticated;
grant execute on function public.get_loading_dashboard(uuid) to authenticated;

create function public.start_loading_session(p_site uuid,p_request uuid,p_facility uuid,p_level uuid,p_vehicle text,p_delivery text) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.sites; existing private.loading_sessions;
begin
 select * into s from public.sites where id=p_site for share;
 if s.id is null or not private.loading_allowed(s.tenant_id,s.id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_request is null or p_vehicle is null or length(btrim(p_vehicle)) not between 2 and 32 or
    p_delivery is null or length(btrim(p_delivery)) not between 2 and 80 or
    not exists(select 1 from public.parking_levels p where p.id=p_level and p.facility_id=p_facility and p.site_id=s.id)
    then raise exception 'Choose a valid mall and level, vehicle and delivery reference' using errcode='22023'; end if;
 select * into existing from private.loading_sessions where id=p_request;
 if found then
  if existing.site_id<>s.id or existing.created_by<>auth.uid() or existing.facility_id<>p_facility or existing.level_id<>p_level
   or existing.vehicle_ref<>upper(btrim(p_vehicle)) or existing.delivery_ref<>btrim(p_delivery) then
    raise exception 'Loading request conflict' using errcode='22023'; end if;
  return existing.id;
 end if;
 if exists(select 1 from private.loading_sessions where site_id=s.id and vehicle_ref=upper(btrim(p_vehicle)) and status='loading') then
   raise exception 'This vehicle already has an active loading session' using errcode='22023'; end if;
 insert into private.loading_sessions(id,tenant_id,site_id,facility_id,level_id,vehicle_ref,delivery_ref,created_by)
 values(p_request,s.tenant_id,s.id,p_facility,p_level,upper(btrim(p_vehicle)),btrim(p_delivery),auth.uid());
 perform private.audit(s.tenant_id,s.id,'loading.arrived',p_request);
 return p_request;
end$$;
revoke all on function public.start_loading_session(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.start_loading_session(uuid,uuid,uuid,uuid,text,text) to authenticated;

create function public.finish_loading_session(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare l private.loading_sessions;
begin
 select * into l from private.loading_sessions where id=p_id for update;
 if l.id is null or not private.loading_allowed(l.tenant_id,l.site_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 if l.status='departed' then return; end if;
 update private.loading_sessions set status='departed',checked_out_at=now() where id=p_id;
 perform private.audit(l.tenant_id,l.site_id,'loading.departed',p_id);
end$$;
revoke all on function public.finish_loading_session(uuid) from public,anon,authenticated;
grant execute on function public.finish_loading_session(uuid) to authenticated;

-- Managers only: explicitly authorized and audited inventory CSV, capped to recent 1000 records.
create function public.export_loading_records(p_site uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.sites; records jsonb;
begin
 select * into s from public.sites where id=p_site;
 if s.id is null or not exists(select 1 from public.memberships m where m.user_id=auth.uid() and m.active
   and m.site_id=s.id and m.tenant_id=s.tenant_id and m.role in ('SITE_MANAGER','TOWNSHIP_ADMIN')) then
   raise exception 'Only site administrators can export loading records' using errcode='42501'; end if;
 if p_reason not in ('operations_review','incident_review') or p_reason is null then raise exception 'Choose an export purpose' using errcode='22023'; end if;
 select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into records from (
  select l.id,l.vehicle_ref,l.delivery_ref,f.name facility,p.name level,l.status,l.checked_in_at,l.checked_out_at
  from private.loading_sessions l join public.parking_facilities f on f.id=l.facility_id
  join public.parking_levels p on p.id=l.level_id
  where l.site_id=s.id order by l.checked_in_at desc limit 1000
 ) x;
 perform private.audit(s.tenant_id,s.id,'loading.exported',s.id);
 return jsonb_build_object('records',records,'count',jsonb_array_length(records));
end$$;
revoke all on function public.export_loading_records(uuid,text) from public,anon,authenticated;
grant execute on function public.export_loading_records(uuid,text) to authenticated;

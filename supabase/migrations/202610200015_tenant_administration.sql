-- Global administration is an explicitly provisioned grant, separate from site roles/PII.
create table public.platform_admins(user_id uuid primary key references auth.users,active boolean not null default true,created_at timestamptz not null default now());
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from public,anon,authenticated;
grant select on public.platform_admins to authenticated;
create policy platform_grant_self on public.platform_admins for select to authenticated using(user_id=auth.uid() and active);
create table private.platform_audit(id uuid primary key default gen_random_uuid(),actor uuid not null references auth.users,action text not null,record_id uuid not null,created_at timestamptz not null default now());
alter table private.platform_audit enable row level security;
revoke all on private.platform_audit from public,anon,authenticated;
create function private.platform_allowed() returns boolean language sql stable security definer set search_path='' as $$select exists(select 1 from public.platform_admins where user_id=auth.uid() and active)$$;
revoke all on function private.platform_allowed() from public,anon,authenticated;
create function private.require_platform_stepup() returns void language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.runtime_settings where simulations_enabled and environment in ('development','test')) and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
   raise exception 'Multi-factor step-up required' using errcode='42501'; end if;
end$$;
revoke all on function private.require_platform_stepup() from public,anon,authenticated;
create function public.get_platform_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not private.platform_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 select jsonb_build_object('tenants',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from
 (select t.id,t.name,t.demo,(select count(*) from public.sites where tenant_id=t.id) as sites,(select count(*) from public.memberships where tenant_id=t.id and active) as active_memberships from public.tenants t order by name limit 200) t),
 'audit',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from (select action,record_id,actor,created_at from private.platform_audit order by created_at desc limit 100) a),
 'simulation_enabled',(select simulations_enabled and environment in ('development','test') from private.runtime_settings),
 'integrations',jsonb_build_object('sms','Not configured; simulator only','routing','Not configured; capacity-only dispatch','iot','Signed HTTPS adapter available; hardware credentials provisioned separately')) into result;
 return result;
end$$;
revoke all on function public.get_platform_overview() from public,anon,authenticated;
grant execute on function public.get_platform_overview() to authenticated;
create function public.create_platform_tenant(p_id uuid,p_name text,p_site_name text,p_admin uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare s uuid; demo boolean;
begin
 if not private.platform_allowed() then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_platform_stepup();
 if p_id is null or p_name is null or p_site_name is null or length(btrim(p_name)) not between 1 and 100 or length(btrim(p_site_name)) not between 1 and 100 or p_admin is null then raise exception 'Invalid tenant setup' using errcode='22023'; end if;
 perform 1 from public.platform_admins where user_id=auth.uid() for update;
 if exists(select 1 from public.tenants where id=p_id) then
   if exists(select 1 from private.platform_audit where actor=auth.uid() and action='tenant.created' and record_id=p_id) and
   exists(select 1 from public.tenants t join public.sites s on s.tenant_id=t.id join public.memberships m on m.site_id=s.id where t.id=p_id and t.name=btrim(p_name) and s.name=btrim(p_site_name) and m.user_id=p_admin and m.role='TOWNSHIP_ADMIN') then return p_id; end if;
   raise exception 'Tenant setup request conflict' using errcode='22023';
 end if;
 if (select count(*) from private.platform_audit where actor=auth.uid() and action='tenant.created' and created_at>now()-interval '1 hour')>=10 then raise exception 'Tenant creation limit'; end if;
 select simulations_enabled and environment in ('development','test') into demo from private.runtime_settings;
 insert into public.tenants(id,name,demo) values(p_id,btrim(p_name),demo);
 insert into public.sites(tenant_id,name) values(p_id,btrim(p_site_name)) returning id into s;
 insert into public.memberships(tenant_id,site_id,user_id,role,capabilities) values(p_id,s,p_admin,'TOWNSHIP_ADMIN',
 array['sites.manage','staff.manage','staff.invite','visits.read.site','visits.checkin','visits.assist','visits.forms.manage','exports.visits','fleet.configure','fleet.dispatch','parking.configure','parking.update.manual','privacy.review','privacy.hold','analytics.read','audit.read']);
 insert into private.platform_audit(actor,action,record_id) values(auth.uid(),'tenant.created',p_id);
 return p_id;
end$$;
revoke all on function public.create_platform_tenant(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.create_platform_tenant(uuid,text,text,uuid) to authenticated;
create function public.create_township_site(p_tenant uuid,p_id uuid,p_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare m public.memberships;
begin
 perform 1 from public.tenants where id=p_tenant for update;
 select * into m from public.memberships where user_id=auth.uid() and tenant_id=p_tenant and active and role='TOWNSHIP_ADMIN' and 'sites.manage'=any(capabilities) order by id limit 1;
 if m.id is null then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(p_tenant);
 if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 100 then raise exception 'Invalid site' using errcode='22023'; end if;
 if exists(select 1 from public.sites where id=p_id and tenant_id=p_tenant and name=btrim(p_name)) and exists(select 1 from public.audit_events where actor=auth.uid() and action='site.created' and record_id=p_id) then return p_id; end if;
 insert into public.sites(id,tenant_id,name) values(p_id,p_tenant,btrim(p_name));
 insert into public.memberships(tenant_id,site_id,user_id,role,capabilities) values(p_tenant,p_id,auth.uid(),m.role,m.capabilities);
 perform private.audit(p_tenant,p_id,'site.created',p_id);return p_id;
end$$;
revoke all on function public.create_township_site(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_township_site(uuid,uuid,text) to authenticated;

-- New hosted projects can opt out of Supabase's legacy automatic service grants.
-- Seed/bridge access must not depend on those project defaults. These grants are
-- server-only; browser roles continue to have no table mutation privileges.
grant select,insert on public.tenants,public.sites,public.stops,public.memberships,
 public.vehicles,public.parking_zones,public.iot_devices,public.platform_admins to service_role;

create or replace function public.deployment_health() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('tenants','sites','memberships','stops','audit_events','invitations','visits','parking_zones','iot_devices','iot_events','vehicles','rides','gps_observations','visitor_form_versions','visitor_form_responses','parking_facilities','parking_levels','parking_bays','transport_routes','platform_admins')),
 'unprotected',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'client_mutable',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
 'site_foreign_keys',(select count(*)=5 from pg_catalog.pg_constraint where conname in ('visit_invitation_site','event_device_site','pickup_service','destination_service','rides_tenant_id_site_id_vehicle_id_fkey') and contype='f'),
 'retention_scheduled',exists(select 1 from cron.job where jobname='smarttownship-retention' and active));
$$;

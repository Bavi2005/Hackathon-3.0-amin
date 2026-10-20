-- Controlled, append-only form versions. No existing data or grants are replaced.
create function private.valid_visitor_fields(p_fields jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare f jsonb; seen text[]:='{}'; k text;
begin
 if p_fields is null or jsonb_typeof(p_fields)<>'array' then return false; end if;
 if jsonb_array_length(p_fields)>5 then return false; end if;
 for f in select value from jsonb_array_elements(p_fields) loop
   if jsonb_typeof(f)<>'object' then return false; end if;
   if (select count(*) from jsonb_object_keys(f))<>2 or not(f ?& array['key','required'])
     or jsonb_typeof(f->'key')<>'string' or jsonb_typeof(f->'required')<>'boolean' then return false; end if;
   k:=f->>'key';
   if k not in ('purpose','party_size','arrival_date','company','safety_ack') or k=any(seen) then return false; end if;
   seen:=array_append(seen,k);
 end loop;
 return true;
end$$;
revoke all on function private.valid_visitor_fields(jsonb) from public,anon,authenticated;

create function private.valid_visitor_answers(p_fields jsonb,p_answers jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare f jsonb; a jsonb; k text; d date;
begin
 if not private.valid_visitor_fields(p_fields) or p_answers is null or jsonb_typeof(p_answers)<>'object' then return false; end if;
 if octet_length(p_answers::text)>2048 then return false; end if;
 if exists(select 1 from jsonb_object_keys(p_answers) x(key)
   where not exists(select 1 from jsonb_array_elements(p_fields) v where v->>'key'=x.key)) then return false; end if;
 for f in select value from jsonb_array_elements(p_fields) loop
   k:=f->>'key'; a:=p_answers->k;
   if a is null then
     if (f->>'required')::boolean then return false; end if;
     continue;
   end if;
   if k='party_size' then
     if jsonb_typeof(a)<>'number' then return false; end if;
     if (a::text)::numeric not between 1 and 20 or trunc((a::text)::numeric)<>(a::text)::numeric then return false; end if;
   elsif k='safety_ack' then
     if jsonb_typeof(a)<>'boolean' or ((f->>'required')::boolean and a<>'true'::jsonb) then return false; end if;
   else
     if jsonb_typeof(a)<>'string' then return false; end if;
     if k='purpose' and (p_answers->>k) not in ('Social visit','Delivery','Meeting','Maintenance','Event') then return false; end if;
     if k='company' and (length(btrim(p_answers->>k))=0 or length(p_answers->>k)>80) then return false; end if;
     if k='arrival_date' then
       if (p_answers->>k)!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' then return false; end if;
       d:=(p_answers->>k)::date;
       if to_char(d,'YYYY-MM-DD')<>p_answers->>k then return false; end if;
     end if;
   end if;
 end loop;
 return true;
exception when datetime_field_overflow or invalid_datetime_format or invalid_text_representation then return false;
end$$;
revoke all on function private.valid_visitor_answers(jsonb,jsonb) from public,anon,authenticated;

create table public.visitor_form_versions(
 id uuid primary key default gen_random_uuid(), tenant_id uuid not null, site_id uuid not null,
 version int not null check(version>0), title text not null check(length(btrim(title)) between 1 and 80),
 template text not null check(template in ('residential','office','contractor','event','custom')),
 fields jsonb not null check(private.valid_visitor_fields(fields)),
 published_by uuid not null references auth.users, publish_request_id uuid not null,
 created_at timestamptz not null default now(),
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id),
 unique(tenant_id,site_id,id), unique(site_id,version), unique(site_id,publish_request_id)
);
alter table public.visitor_form_versions enable row level security;
revoke all on public.visitor_form_versions from public,anon,authenticated;
-- Management/read RPCs return only purpose-appropriate metadata; no raw table access.
alter table public.sites add column visitor_form_version_id uuid;
alter table public.sites add constraint site_active_visitor_form foreign key(tenant_id,id,visitor_form_version_id)
 references public.visitor_form_versions(tenant_id,site_id,id);
alter table public.invitations add column form_version_id uuid;
alter table public.invitations add constraint invitation_visitor_form foreign key(tenant_id,site_id,form_version_id)
 references public.visitor_form_versions(tenant_id,site_id,id);
create function private.immutable_invitation_form() returns trigger language plpgsql set search_path='' as $$
begin
 if new.form_version_id is distinct from old.form_version_id then raise exception 'Invitation form is immutable' using errcode='23514'; end if;
 return new;
end$$;
revoke all on function private.immutable_invitation_form() from public,anon,authenticated;
create trigger immutable_invitation_form before update on public.invitations
 for each row execute function private.immutable_invitation_form();
alter table public.visits add unique(tenant_id,site_id,id);
create table public.visitor_form_responses(
 visit_id uuid primary key, tenant_id uuid not null, site_id uuid not null, form_version_id uuid,
 answers jsonb not null default '{}'::jsonb check(jsonb_typeof(answers)='object' and octet_length(answers::text)<=2048),
 notice_version text not null default 'demo-notice-v1' check(notice_version='demo-notice-v1'),
 acknowledged_at timestamptz not null default now(), anonymized_at timestamptz,
 foreign key(tenant_id,site_id,visit_id) references public.visits(tenant_id,site_id,id),
 foreign key(tenant_id,site_id,form_version_id) references public.visitor_form_versions(tenant_id,site_id,id),
 check(anonymized_at is null or (answers='{}'::jsonb and anonymized_at>=acknowledged_at))
);
alter table public.visitor_form_responses enable row level security;
revoke all on public.visitor_form_responses from public,anon,authenticated;

create function private.immutable_visitor_form() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Published form versions are immutable' using errcode='23514'; end$$;
revoke all on function private.immutable_visitor_form() from public,anon,authenticated;
create trigger immutable_visitor_form before update or delete on public.visitor_form_versions
 for each row execute function private.immutable_visitor_form();

create function private.check_visitor_response() returns trigger language plpgsql security definer set search_path='' as $$
declare expected uuid; fields jsonb;
begin
 select i.form_version_id into expected from public.visits v join public.invitations i on i.id=v.invitation_id
 where v.id=new.visit_id and v.tenant_id=new.tenant_id and v.site_id=new.site_id;
 if not found or new.form_version_id is distinct from expected then
   raise exception 'Response form does not match invitation' using errcode='23514'; end if;
 if tg_op='UPDATE' and (new.visit_id is distinct from old.visit_id or new.form_version_id is distinct from old.form_version_id
   or new.tenant_id is distinct from old.tenant_id or new.site_id is distinct from old.site_id
   or new.acknowledged_at is distinct from old.acknowledged_at) then
   raise exception 'Response identity is immutable' using errcode='23514'; end if;
 if new.anonymized_at is not null then return new; end if;
 select v.fields into fields from public.visitor_form_versions v where v.id=new.form_version_id;
 if not private.valid_visitor_answers(coalesce(fields,'[]'::jsonb),new.answers) then
   raise exception 'Invalid visitor answers' using errcode='23514'; end if;
 return new;
end$$;
revoke all on function private.check_visitor_response() from public,anon,authenticated;
create trigger check_visitor_response before insert or update on public.visitor_form_responses
 for each row execute function private.check_visitor_response();

create function private.visitor_form_json(p_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',id,'version',version,'title',title,'template',template,'fields',fields,'created_at',created_at)
 from public.visitor_form_versions where id=p_id
$$;
revoke all on function private.visitor_form_json(uuid) from public,anon,authenticated;

create function public.get_site_visitor_forms(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; history jsonb;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id,'visits.forms.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(private.visitor_form_json(h.id) order by h.version desc),'[]'::jsonb) into history
 from (select id,version from public.visitor_form_versions where tenant_id=s.tenant_id and site_id=s.id order by version desc limit 20) h;
 return jsonb_build_object('active',private.visitor_form_json(s.visitor_form_version_id),'history',history);
end$$;
revoke all on function public.get_site_visitor_forms(uuid) from public,anon,authenticated;
grant execute on function public.get_site_visitor_forms(uuid) to authenticated;

create function public.publish_visitor_form(p_site uuid,p_request uuid,p_expected uuid,p_title text,p_template text,p_fields jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; previous public.visitor_form_versions; ident uuid; ver int;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'visits.forms.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_request is null or p_title is null or length(btrim(p_title)) not between 1 and 80
   or p_template is null or p_template not in ('residential','office','contractor','event','custom')
   or not private.valid_visitor_fields(p_fields) then raise exception 'Invalid visitor form' using errcode='22023'; end if;
 select * into previous from public.visitor_form_versions where site_id=s.id and publish_request_id=p_request;
 if found then
   if previous.published_by<>auth.uid() or previous.title<>btrim(p_title) or previous.template<>p_template or previous.fields<>p_fields then
     raise exception 'Publish request conflict' using errcode='22023'; end if;
   return private.visitor_form_json(previous.id);
 end if;
 if s.visitor_form_version_id is distinct from p_expected then raise exception 'Form changed; reload before publishing' using errcode='22023'; end if;
 select coalesce(max(version),0)+1 into ver from public.visitor_form_versions where site_id=s.id;
 insert into public.visitor_form_versions(tenant_id,site_id,version,title,template,fields,published_by,publish_request_id)
 values(s.tenant_id,s.id,ver,btrim(p_title),p_template,p_fields,auth.uid(),p_request) returning id into ident;
 update public.sites set visitor_form_version_id=ident where id=s.id;
 perform private.audit(s.tenant_id,s.id,'visitor.form.published',ident);
 return private.visitor_form_json(ident);
end$$;
revoke all on function public.publish_visitor_form(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.publish_visitor_form(uuid,uuid,uuid,text,text,jsonb) to authenticated;

create or replace function public.create_invitation(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; tok text; ident uuid;
begin
 select * into s from public.sites where id=p_site for share;
 if not private.allowed(s.tenant_id,s.id,'visits.invite') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.memberships where user_id=auth.uid() and site_id=p_site for update;
 if (select count(*) from public.invitations where owner_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'Invitation rate limit'; end if;
 tok:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.invitations(tenant_id,site_id,owner_id,token_hash,expires_at,form_version_id)
 values(s.tenant_id,s.id,auth.uid(),encode(extensions.digest(tok,'sha256'),'hex'),now()+interval '24 hours',s.visitor_form_version_id) returning id into ident;
 perform private.audit(s.tenant_id,s.id,'invitation.created',ident);
 return jsonb_build_object('id',ident,'token',tok,'expires_at',now()+interval '24 hours');
end$$;

create function public.resolve_visitor_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; site_name text; demo boolean;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then raise exception 'Invitation unavailable'; end if;
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if i.id is null or i.expires_at<=now() or i.redeemed_at is not null then raise exception 'Invitation unavailable'; end if;
 select s.name,t.demo into site_name,demo from public.sites s join public.tenants t on t.id=s.tenant_id where s.id=i.site_id;
 return jsonb_build_object('site_name',site_name,'expires_at',i.expires_at,'form',private.visitor_form_json(i.form_version_id),'notice_version','demo-notice-v1','demo',demo);
end$$;
revoke all on function public.resolve_visitor_invitation(text) from public,anon,authenticated;
grant execute on function public.resolve_visitor_invitation(text) to anon,authenticated;

create function public.submit_visitor_registration(p_token text,p_name text,p_consent boolean,p_answers jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; ident uuid; fields jsonb;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' or p_name is null or length(trim(p_name)) not between 1 and 80 or p_consent is distinct from true then raise exception 'Invalid registration'; end if;
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.expires_at<=now() or i.redeemed_at is not null then raise exception 'Invitation unavailable'; end if;
 select v.fields into fields from public.visitor_form_versions v where v.id=i.form_version_id;
 if not private.valid_visitor_answers(coalesce(fields,'[]'::jsonb),p_answers) then raise exception 'Invalid visitor answers' using errcode='22023'; end if;
 insert into public.visits(tenant_id,site_id,invitation_id,owner_id,guest_name) values(i.tenant_id,i.site_id,i.id,i.owner_id,trim(p_name)) returning id into ident;
 insert into public.visitor_form_responses(visit_id,tenant_id,site_id,form_version_id,answers)
 values(ident,i.tenant_id,i.site_id,i.form_version_id,p_answers);
 update public.invitations set redeemed_at=now() where id=i.id;
 perform private.audit(i.tenant_id,i.site_id,'visitor.registered.notice-v1',ident);
 return ident;
end$$;
revoke all on function public.submit_visitor_registration(text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.submit_visitor_registration(text,text,boolean,jsonb) to anon,authenticated;
-- Retain the old contract but do not let it bypass a version's required answers.
create or replace function public.redeem_invitation(p_token text,p_name text,p_consent boolean) returns uuid
language sql security definer set search_path='' as $$select public.submit_visitor_registration(p_token,p_name,p_consent,'{}'::jsonb)$$;

create function public.get_visit_form_response(p_visit uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare v public.visits; r public.visitor_form_responses;
begin
 select * into v from public.visits where id=p_visit;
 if not private.allowed(v.tenant_id,v.site_id) or not(v.owner_id=auth.uid() or private.allowed(v.tenant_id,v.site_id,'visits.read.site')) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 select * into r from public.visitor_form_responses where visit_id=v.id and tenant_id=v.tenant_id and site_id=v.site_id;
 perform private.audit(v.tenant_id,v.site_id,'visitor.answers.read',v.id);
 return jsonb_build_object('form',private.visitor_form_json(r.form_version_id),'answers',coalesce(r.answers,'{}'::jsonb),
   'acknowledged_at',r.acknowledged_at,'anonymized_at',r.anonymized_at);
end$$;
revoke all on function public.get_visit_form_response(uuid) from public,anon,authenticated;
grant execute on function public.get_visit_form_response(uuid) to authenticated;

create or replace function private.retain() returns void language plpgsql security definer set search_path='' as $$
begin
 delete from public.gps_observations where observed_at<now()-interval '24 hours';
 update public.vehicles set lat=null,lng=null,accuracy=null,observed_at=null where observed_at<now()-interval '24 hours';
 delete from public.iot_events where created_at<now()-interval '7 days';
 update public.visits set guest_name='[retained anonymously]' where created_at<now()-interval '30 days' and guest_name<>'[retained anonymously]';
 update public.visitor_form_responses r set answers='{}'::jsonb,anonymized_at=now()
 where r.anonymized_at is null and exists(select 1 from public.visits v where v.id=r.visit_id and v.created_at<now()-interval '30 days');
 delete from public.audit_events where created_at<now()-interval '90 days';
end$$;

create or replace function public.deployment_health() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
 'tables',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname in ('tenants','sites','memberships','stops','audit_events','invitations','visits','parking_zones','iot_devices','iot_events','vehicles','rides','gps_observations','visitor_form_versions','visitor_form_responses')),
 'unprotected',(select count(*) from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity),
 'client_mutable',(select count(*) from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and privilege_type in ('INSERT','UPDATE','DELETE','TRUNCATE')),
 'site_foreign_keys',(select count(*)=5 from pg_catalog.pg_constraint where conname in ('visit_invitation_site','event_device_site','pickup_service','destination_service','rides_tenant_id_site_id_vehicle_id_fkey') and contype='f'),
 'retention_scheduled',exists(select 1 from cron.job where jobname='smarttownship-retention' and active));
$$;

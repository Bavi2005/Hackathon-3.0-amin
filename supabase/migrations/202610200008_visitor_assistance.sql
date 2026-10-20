-- Simulation is a deployment setting, never a browser/member-controlled flag.
create table private.runtime_settings(
 singleton boolean primary key default true check(singleton),
 environment text not null default 'production' check(environment in ('production','development','test')),
 simulations_enabled boolean not null default false,
 otp_key bytea not null default extensions.gen_random_bytes(32),
 check(not simulations_enabled or environment in ('development','test'))
);
insert into private.runtime_settings(singleton) values(true);
alter table private.runtime_settings enable row level security;
revoke all on private.runtime_settings from public,anon,authenticated;
create function private.simulation_allowed(p_tenant uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.runtime_settings r join public.tenants t on t.id=p_tenant
 where r.simulations_enabled and r.environment in ('development','test') and t.demo)
$$;
revoke all on function private.simulation_allowed(uuid) from public,anon,authenticated;

create table private.visitor_otp_challenges(
 id uuid primary key default gen_random_uuid(), invitation_id uuid not null references public.invitations,
 request_id uuid not null, code_hash text not null, attempts int not null default 0 check(attempts between 0 and 5),
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 verified_at timestamptz, consumed_at timestamptz, invalidated_at timestamptz,
 unique(invitation_id,request_id)
);
create index on private.visitor_otp_challenges(invitation_id,created_at desc);
alter table private.visitor_otp_challenges enable row level security;
revoke all on private.visitor_otp_challenges from public,anon,authenticated;

create function private.otp_hash(p_id uuid,p_code text) returns text language sql stable security definer set search_path='' as $$
 select encode(extensions.hmac(convert_to(p_id::text||':'||p_code,'UTF8'),otp_key,'sha256'),'hex') from private.runtime_settings
$$;
revoke all on function private.otp_hash(uuid,text) from public,anon,authenticated;

create function public.request_visitor_otp(p_token text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; c private.visitor_otp_challenges; ident uuid:=gen_random_uuid(); code text; bytes bytea; n int;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' or p_request is null then raise exception 'Invitation unavailable'; end if;
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.redeemed_at is not null or i.expires_at<=now() then raise exception 'Invitation unavailable'; end if;
 if not private.simulation_allowed(i.tenant_id) then raise exception 'OTP provider unavailable' using errcode='55000'; end if;
 select * into c from private.visitor_otp_challenges where invitation_id=i.id and request_id=p_request;
 if found then
   return jsonb_build_object('id',c.id,'provider','simulator','expires_at',c.expires_at,'demo_code',null,'replayed',true);
 end if;
 if exists(select 1 from private.visitor_otp_challenges where invitation_id=i.id and created_at>now()-interval '60 seconds')
 or (select count(*) from private.visitor_otp_challenges where invitation_id=i.id and created_at>now()-interval '1 hour')>=3 then
   raise exception 'OTP request limit reached; wait before retrying' using errcode='P0001'; end if;
 -- Rejection sampling avoids modulo bias. Only the first response contains the demo code.
 loop
   bytes:=extensions.gen_random_bytes(3); n:=get_byte(bytes,0)*65536+get_byte(bytes,1)*256+get_byte(bytes,2);
   exit when n<16000000;
 end loop;
 code:=lpad((n%1000000)::text,6,'0');
 update private.visitor_otp_challenges set invalidated_at=now() where invitation_id=i.id and invalidated_at is null;
 insert into private.visitor_otp_challenges(id,invitation_id,request_id,code_hash,expires_at)
 values(ident,i.id,p_request,private.otp_hash(ident,code),least(now()+interval '5 minutes',i.expires_at));
 perform private.audit(i.tenant_id,i.site_id,'visitor.otp.simulator.requested',ident);
 return jsonb_build_object('id',ident,'provider','simulator','expires_at',least(now()+interval '5 minutes',i.expires_at),'demo_code',code,'replayed',false);
end$$;
revoke all on function public.request_visitor_otp(text,uuid) from public,anon,authenticated;
grant execute on function public.request_visitor_otp(text,uuid) to anon,authenticated;

create function public.verify_visitor_otp(p_token text,p_challenge uuid,p_code text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; c private.visitor_otp_challenges;
begin
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.redeemed_at is not null or i.expires_at<=now() or not private.simulation_allowed(i.tenant_id) then
   return jsonb_build_object('verified',false,'message','Code unavailable or expired'); end if;
 select * into c from private.visitor_otp_challenges where id=p_challenge and invitation_id=i.id for update;
 if c.id is null or c.expires_at<=now() or c.invalidated_at is not null or c.consumed_at is not null or c.verified_at is not null or c.attempts>=5 then
   return jsonb_build_object('verified',false,'message','Code unavailable or expired'); end if;
 update private.visitor_otp_challenges set attempts=attempts+1 where id=c.id;
 if p_code is null or p_code!~'^[0-9]{6}$' or private.otp_hash(c.id,p_code)<>c.code_hash then
   -- Return an ordinary response: raising would roll back the failed-attempt counter.
   perform private.audit(i.tenant_id,i.site_id,'visitor.otp.simulator.rejected',c.id);
   return jsonb_build_object('verified',false,'message','Invalid code','attempts_remaining',4-c.attempts);
 end if;
 update private.visitor_otp_challenges set verified_at=now() where id=c.id;
 perform private.audit(i.tenant_id,i.site_id,'visitor.otp.simulator.verified',c.id);
 return jsonb_build_object('verified',true,'provider','simulator','expires_at',c.expires_at);
end$$;
revoke all on function public.verify_visitor_otp(text,uuid,text) from public,anon,authenticated;
grant execute on function public.verify_visitor_otp(text,uuid,text) to anon,authenticated;

-- Rename the existing implementation, then wrap ALL registration paths with OTP consumption.
alter function public.submit_visitor_registration(text,text,boolean,jsonb) rename to register_visitor_validated;
alter function public.register_visitor_validated(text,text,boolean,jsonb) set schema private;
revoke all on function private.register_visitor_validated(text,text,boolean,jsonb) from public,anon,authenticated;
create function public.submit_visitor_registration(p_token text,p_name text,p_consent boolean,p_answers jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; c private.visitor_otp_challenges; ident uuid;
begin
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if i.id is null or i.redeemed_at is not null or i.expires_at<=now() then raise exception 'Invitation unavailable'; end if;
 select * into c from private.visitor_otp_challenges where invitation_id=i.id and invalidated_at is null order by created_at desc limit 1;
 if c.id is not null and (c.verified_at is null or c.expires_at<=now() or c.consumed_at is not null or not private.simulation_allowed(i.tenant_id)) then
   raise exception 'Complete OTP verification or ask the guard for assistance' using errcode='22023'; end if;
 ident:=private.register_visitor_validated(p_token,p_name,p_consent,p_answers);
 if c.id is not null then update private.visitor_otp_challenges set consumed_at=now() where id=c.id; end if;
 return ident;
end$$;
revoke all on function public.submit_visitor_registration(text,text,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.submit_visitor_registration(text,text,boolean,jsonb) to anon,authenticated;
create or replace function public.redeem_invitation(p_token text,p_name text,p_consent boolean) returns uuid
language sql security definer set search_path='' as $$select public.submit_visitor_registration(p_token,p_name,p_consent,'{}'::jsonb)$$;

create or replace function public.resolve_visitor_invitation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; site_name text; demo boolean; otp jsonb;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then raise exception 'Invitation unavailable'; end if;
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if i.id is null or i.expires_at<=now() or i.redeemed_at is not null then raise exception 'Invitation unavailable'; end if;
 select s.name,t.demo into site_name,demo from public.sites s join public.tenants t on t.id=s.tenant_id where s.id=i.site_id;
 select jsonb_build_object('id',id,'expires_at',expires_at,'verified',verified_at is not null and expires_at>now(),'attempts_remaining',5-attempts)
 into otp from private.visitor_otp_challenges where invitation_id=i.id and invalidated_at is null order by created_at desc limit 1;
 return jsonb_build_object('site_name',site_name,'expires_at',i.expires_at,'form',private.visitor_form_json(i.form_version_id),
 'notice_version','demo-notice-v1','demo',demo,'otp_provider',case when private.simulation_allowed(i.tenant_id) then 'simulator' else 'unavailable' end,'otp',otp);
end$$;

create table private.assisted_registrations(
 request_id uuid primary key, tenant_id uuid not null,site_id uuid not null,actor uuid not null references auth.users,
 invitation_id uuid not null,visit_id uuid not null,payload_hash text not null,
 reason text not null check(reason in ('no_smartphone','weak_signal','accessibility')),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,site_id,invitation_id) references public.invitations(tenant_id,site_id,id),
 foreign key(tenant_id,site_id,visit_id) references public.visits(tenant_id,site_id,id)
);
alter table private.assisted_registrations enable row level security;
revoke all on private.assisted_registrations from public,anon,authenticated;
create function public.resolve_assisted_invitation(p_site uuid,p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations;
begin
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and site_id=p_site;
 if not private.allowed(i.tenant_id,i.site_id,'visits.assist') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.audit(i.tenant_id,i.site_id,'visitor.assistance.opened',i.id);
 return public.resolve_visitor_invitation(p_token);
end$$;
revoke all on function public.resolve_assisted_invitation(uuid,text) from public,anon,authenticated;
grant execute on function public.resolve_assisted_invitation(uuid,text) to authenticated;
create function public.register_assisted_visitor(p_site uuid,p_request uuid,p_token text,p_name text,p_consent boolean,p_answers jsonb,p_reason text,p_policy_checked boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; previous private.assisted_registrations; ident uuid; fingerprint text;
begin
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') and site_id=p_site for update;
 if not private.allowed(i.tenant_id,i.site_id,'visits.assist') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_request is null or p_policy_checked is distinct from true or p_reason is null or p_reason not in ('no_smartphone','weak_signal','accessibility') then
   raise exception 'Assistance reason and local entry policy check are required' using errcode='22023'; end if;
 fingerprint:=encode(extensions.hmac(convert_to(jsonb_build_array(p_name,p_consent,p_answers,p_reason)::text,'UTF8'),
 (select otp_key from private.runtime_settings),'sha256'),'hex');
 select * into previous from private.assisted_registrations where request_id=p_request;
 if found then
   if previous.actor<>auth.uid() or previous.invitation_id<>i.id or previous.site_id<>p_site or previous.payload_hash<>fingerprint then
     raise exception 'Assistance request conflict' using errcode='22023'; end if;
   return previous.visit_id;
 end if;
 perform 1 from public.memberships where user_id=auth.uid() and site_id=p_site for update;
 if (select count(*) from private.assisted_registrations where actor=auth.uid() and created_at>now()-interval '1 hour')>=60 then
   raise exception 'Assistance rate limit reached'; end if;
 -- Explicit audited human fallback. This is NOT an OTP/identity verification claim.
 ident:=private.register_visitor_validated(p_token,p_name,p_consent,p_answers);
 update private.visitor_otp_challenges set invalidated_at=now() where invitation_id=i.id and invalidated_at is null;
 insert into private.assisted_registrations(request_id,tenant_id,site_id,actor,invitation_id,visit_id,payload_hash,reason)
 values(p_request,i.tenant_id,i.site_id,auth.uid(),i.id,ident,fingerprint,p_reason);
 insert into public.audit_events(tenant_id,site_id,actor,action,record_id,metadata)
 values(i.tenant_id,i.site_id,auth.uid(),'visitor.assisted.registered',ident,jsonb_build_object('reason',p_reason,'policy_checked',true,'otp_bypassed',true));
 return ident;
end$$;
revoke all on function public.register_assisted_visitor(uuid,uuid,text,text,boolean,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.register_assisted_visitor(uuid,uuid,text,text,boolean,jsonb,text,boolean) to authenticated;

-- Preserve existing cleanup and extend it. Keep counters until invitation expiry.
alter function private.retain() rename to retain_visitor_forms;
create function private.retain() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.retain_visitor_forms();
 delete from private.visitor_otp_challenges c using public.invitations i where c.invitation_id=i.id and i.expires_at<now()-interval '1 day';
 delete from private.assisted_registrations where created_at<now()-interval '30 days';
end$$;
revoke all on function private.retain() from public,anon,authenticated;

-- Apply the same non-production gate to the existing parking/GPS simulators.
create or replace function public.simulate_parking(p_device uuid,p_occupied int) returns void language plpgsql security definer set search_path='' as $$
declare d public.iot_devices;
begin
 select * into d from public.iot_devices where id=p_device for update;
 if not private.simulation_allowed(d.tenant_id) or not private.allowed(d.tenant_id,d.site_id,'parking.simulate') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.ingest(d.id,gen_random_uuid(),d.last_sequence+1,p_occupied,now(),true);
 perform private.audit(d.tenant_id,d.site_id,'parking.simulated',d.zone_id);
end$$;
alter function public.telemetry(uuid,double precision,double precision,double precision,timestamptz,boolean) rename to record_telemetry;
alter function public.record_telemetry(uuid,double precision,double precision,double precision,timestamptz,boolean) set schema private;
revoke all on function private.record_telemetry(uuid,double precision,double precision,double precision,timestamptz,boolean) from public,anon,authenticated;
create function public.telemetry(p_vehicle uuid,p_lat double precision,p_lng double precision,p_accuracy double precision,p_observed timestamptz,p_simulated boolean default false)
returns void language plpgsql security definer set search_path='' as $$
begin
 if p_simulated is null or (p_simulated and not private.simulation_allowed((select tenant_id from public.vehicles where id=p_vehicle))) then
   raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.record_telemetry(p_vehicle,p_lat,p_lng,p_accuracy,p_observed,p_simulated);
end$$;
revoke all on function public.telemetry(uuid,double precision,double precision,double precision,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.telemetry(uuid,double precision,double precision,double precision,timestamptz,boolean) to authenticated;

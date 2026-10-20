begin;
create extension if not exists pgtap with schema extensions;
select plan(34);
insert into auth.users(id) values ('04000000-0000-4000-8000-000000000001'),('04000000-0000-4000-8000-000000000002'),('04000000-0000-4000-8000-000000000003');
insert into public.tenants(id,name,demo) values ('14000000-0000-4000-8000-000000000001','OTP fictional tenant',true),('14000000-0000-4000-8000-000000000002','Other OTP tenant',true);
insert into public.sites(id,tenant_id,name) values
 ('24000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001','OTP site'),
 ('24000000-0000-4000-8000-000000000002','14000000-0000-4000-8000-000000000002','Other OTP site');
insert into public.memberships(tenant_id,site_id,user_id,role,capabilities) values
 ('14000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','04000000-0000-4000-8000-000000000001','RESIDENT',array['visits.invite']),
 ('14000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000001','04000000-0000-4000-8000-000000000002','STAFF',array['visits.assist','visits.checkin','visits.read.site']),
 ('14000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000002','04000000-0000-4000-8000-000000000003','STAFF',array['visits.assist']);
create temp table assistance_ctx(name text primary key,data jsonb);
grant all on assistance_ctx to anon,authenticated;
create function pg_temp.token(n text default 'invite') returns text language sql as $$ select data->>'token' from assistance_ctx where name=n $$;
create function pg_temp.request_code(r uuid default '34000000-0000-4000-8000-000000000001') returns jsonb language sql as $$ select public.request_visitor_otp(pg_temp.token(),r) $$;
create function pg_temp.verify_code(code text) returns jsonb language sql as $$ select public.verify_visitor_otp(pg_temp.token(),(select (data->>'id')::uuid from assistance_ctx where name='otp'),code) $$;
create function pg_temp.assist(s uuid default '24000000-0000-4000-8000-000000000001',reason text default 'no_smartphone',policy boolean default true,n text default 'Fictional assisted guest') returns uuid language sql as $$
 select public.register_assisted_visitor(s,'34000000-0000-4000-8000-000000000010',pg_temp.token('assisted'),n,true,'{}',reason,policy)
$$;
update private.runtime_settings set environment='production',simulations_enabled=false;
set local role authenticated;
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000001',true);
insert into assistance_ctx values('invite',public.create_invitation('24000000-0000-4000-8000-000000000001')),
 ('assisted',public.create_invitation('24000000-0000-4000-8000-000000000001'));
select throws_ok($$select pg_temp.assist()$$,'42501','Forbidden','resident cannot assist');
set local role anon;
select throws_ok($$select pg_temp.request_code()$$,'55000','OTP provider unavailable','production denies OTP simulator');
select throws_ok($$update private.runtime_settings set simulations_enabled=true$$,'42501',null,'browser cannot enable simulation');
select throws_ok($$select pg_temp.assist()$$,'42501',null,'anonymous cannot assist');
reset role;
select throws_ok($$update private.runtime_settings set simulations_enabled=true$$,'23514',null,'production configuration cannot enable simulation');
update private.runtime_settings set environment='test',simulations_enabled=true;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
insert into assistance_ctx values('otp',pg_temp.request_code());
select ok((select data->>'demo_code' from assistance_ctx where name='otp')~'^[0-9]{6}$','simulator returns six digit code');
select is(pg_temp.request_code()->>'id',(select data->>'id' from assistance_ctx where name='otp'),'request retry is idempotent');
select is(pg_temp.request_code()->'demo_code','null'::jsonb,'retry never reveals code again');
select throws_ok($$select pg_temp.request_code('34000000-0000-4000-8000-000000000002')$$,'P0001','OTP request limit reached; wait before retrying','resend cooldown enforced');
select throws_ok($$select public.redeem_invitation(pg_temp.token(),'Fictional',true)$$,'22023','Complete OTP verification or ask the guard for assistance','legacy registration cannot bypass requested OTP');
select is(pg_temp.verify_code('bad')->>'verified','false','wrong code returns failure');
reset role;
select is((select attempts from private.visitor_otp_challenges where id=(select (data->>'id')::uuid from assistance_ctx where name='otp')),1,'failed attempt persisted instead of rolling back');
set local role anon;
select is(pg_temp.verify_code((select data->>'demo_code' from assistance_ctx where name='otp'))->>'verified','true','correct code verifies');
select is(pg_temp.verify_code((select data->>'demo_code' from assistance_ctx where name='otp'))->>'verified','false','verification replay denied');
select lives_ok($$select public.submit_visitor_registration(pg_temp.token(),'Fictional OTP guest',true,'{}')$$,'verified registration succeeds');
select throws_ok($$select public.submit_visitor_registration(pg_temp.token(),'Replay',true,'{}')$$,'P0001','Invitation unavailable','consumed invitation rejected');
reset role;
select ok((select consumed_at is not null from private.visitor_otp_challenges where id=(select (data->>'id')::uuid from assistance_ctx where name='otp')),'OTP consumed atomically with registration');
set local role authenticated;
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000003',true);
select throws_ok($$select pg_temp.assist()$$,'42501','Forbidden','foreign tenant guard denied');
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000002',true);
select throws_ok($$select pg_temp.assist('24000000-0000-4000-8000-000000000002')$$,'42501','Forbidden','mismatched invitation site denied');
select throws_ok($$select pg_temp.assist(reason=>'other')$$,'22023','Assistance reason and local entry policy check are required','unknown reason denied');
select throws_ok($$select pg_temp.assist(policy=>false)$$,'22023','Assistance reason and local entry policy check are required','policy acknowledgement required');
select lives_ok($$select public.resolve_assisted_invitation('24000000-0000-4000-8000-000000000001',pg_temp.token('assisted'))$$,'guard loads scoped form');
insert into assistance_ctx select 'assisted_visit',to_jsonb(pg_temp.assist());
select is(pg_temp.assist()::text,(select data#>>'{}' from assistance_ctx where name='assisted_visit'),'assistance retry returns same visit');
select throws_ok($$select pg_temp.assist(n=>'Changed payload')$$,'22023','Assistance request conflict','idempotency key cannot change visitor');
reset role;
select is((select status from public.visits where id=(select (data#>>'{}')::uuid from assistance_ctx where name='assisted_visit')),'pending_entry','assistance never silently checks visitor in');
select ok(exists(select 1 from public.audit_events where action='visitor.assisted.registered' and actor='04000000-0000-4000-8000-000000000002' and metadata->>'reason'='no_smartphone'),'assistance actor and reason audited');
-- Use a fresh valid invitation to verify expiry and five-attempt lockout.
set local role authenticated;
select set_config('request.jwt.claim.sub','04000000-0000-4000-8000-000000000001',true);
update assistance_ctx set data=public.create_invitation('24000000-0000-4000-8000-000000000001') where name='invite';
set local role anon;
update assistance_ctx set data=pg_temp.request_code() where name='otp';
select pg_temp.verify_code('bad') from generate_series(1,5);
select is(pg_temp.verify_code((select data->>'demo_code' from assistance_ctx where name='otp'))->>'verified','false','correct code denied after five attempts');
reset role;
select is((select attempts from private.visitor_otp_challenges where id=(select (data->>'id')::uuid from assistance_ctx where name='otp')),5,'attempts capped at five');
update private.visitor_otp_challenges set created_at=now()-interval '61 seconds' where invitation_id=(select (data->>'id')::uuid from assistance_ctx where name='invite');
set local role anon;
update assistance_ctx set data=pg_temp.request_code('34000000-0000-4000-8000-000000000002') where name='otp';
reset role;
update private.visitor_otp_challenges set expires_at=now()-interval '1 second' where id=(select (data->>'id')::uuid from assistance_ctx where name='otp');
set local role anon;
select is(pg_temp.verify_code((select data->>'demo_code' from assistance_ctx where name='otp'))->>'verified','false','expired OTP rejected');
select throws_ok($$select * from private.visitor_otp_challenges$$,'42501',null,'anonymous cannot read hashed challenges');
set local role authenticated;
select throws_ok($$select private.register_visitor_validated(pg_temp.token(),'Bypass',true,'{}')$$,'42501',null,'internal registration cannot bypass OTP');
select throws_ok($$select * from private.assisted_registrations$$,'42501',null,'assistance payload fingerprint private');
reset role;
select ok(not exists(select 1 from public.audit_events where metadata::text like '%demo_code%' or metadata::text like '%token%'),'audit contains neither codes nor bearer tokens');
select ok((select bool_and(code_hash !~ '^[0-9]{6}$') from private.visitor_otp_challenges),'codes are not stored in plaintext');
select * from finish();
rollback;

begin;
create extension if not exists pgtap with schema extensions;
select plan(53);
insert into auth.users(id) values
 ('03000000-0000-4000-8000-000000000001'),('03000000-0000-4000-8000-000000000002'),
 ('03000000-0000-4000-8000-000000000003'),('03000000-0000-4000-8000-000000000004'),('03000000-0000-4000-8000-000000000005');
insert into public.tenants(id,name,demo) values
 ('13000000-0000-4000-8000-000000000001','Form test',true),('13000000-0000-4000-8000-000000000002','Unrelated form test',true);
insert into public.sites(id,tenant_id,name) values
 ('23000000-0000-4000-8000-000000000001','13000000-0000-4000-8000-000000000001','Form site'),
 ('23000000-0000-4000-8000-000000000002','13000000-0000-4000-8000-000000000001','Other site'),
 ('23000000-0000-4000-8000-000000000003','13000000-0000-4000-8000-000000000002','Other tenant site');
insert into public.memberships(tenant_id,site_id,user_id,role,capabilities) values
 ('13000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','03000000-0000-4000-8000-000000000001','RESIDENT',array['visits.invite']),
 ('13000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','03000000-0000-4000-8000-000000000002','SITE_MANAGER',array['visits.forms.manage','visits.read.site','audit.read']),
 ('13000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','03000000-0000-4000-8000-000000000003','STAFF',array['visits.read.site','visits.checkin']),
 ('13000000-0000-4000-8000-000000000001','23000000-0000-4000-8000-000000000001','03000000-0000-4000-8000-000000000004','PLATFORM_OPERATOR',array['audit.read']),
 ('13000000-0000-4000-8000-000000000002','23000000-0000-4000-8000-000000000003','03000000-0000-4000-8000-000000000005','SITE_MANAGER',array['visits.forms.manage','visits.read.site']);
create temp table forms_ctx(name text primary key,data jsonb);
grant select,insert,update on forms_ctx to authenticated,anon;
create function pg_temp.form_publish(s uuid default '23000000-0000-4000-8000-000000000001',r uuid default '33000000-0000-4000-8000-000000000001',expected uuid default null,
 fields jsonb default '[{"key":"purpose","required":true},{"key":"company","required":false},{"key":"safety_ack","required":true}]',title text default 'Fictional form')
returns jsonb language sql as $$select public.publish_visitor_form(s,r,expected,title,'custom',fields)$$;
create function pg_temp.form_read(s uuid default '23000000-0000-4000-8000-000000000001') returns jsonb language sql as $$select public.get_site_visitor_forms(s)$$;
create function pg_temp.guest_submit(answers jsonb default '{"purpose":"Delivery","safety_ack":true,"company":"Fictional company"}') returns uuid language sql as $$
 select public.submit_visitor_registration((select data->>'token' from forms_ctx where name='invite'),'Fictional form guest',true,answers)
$$;
set local role anon;
select throws_ok($$select pg_temp.form_read()$$,'42501',null,'anonymous cannot read management forms');
select throws_ok($$select pg_temp.form_publish()$$,'42501',null,'anonymous cannot publish');
set local role authenticated;
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000001',true);
select throws_ok($$select pg_temp.form_read()$$,'42501','Forbidden','resident cannot manage forms');
select throws_ok($$select pg_temp.form_publish()$$,'42501','Forbidden','resident cannot publish');
insert into forms_ctx values('legacy',public.create_invitation('23000000-0000-4000-8000-000000000001'));
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000002',true);
select is(pg_temp.form_read()->'active','null'::jsonb,'site starts with name-only form');
select throws_ok($$select pg_temp.form_read('23000000-0000-4000-8000-000000000002')$$,'42501','Forbidden','cross-site form read denied');
select throws_ok($$select pg_temp.form_publish('23000000-0000-4000-8000-000000000002')$$,'42501','Forbidden','cross-site publish denied');
select throws_ok($$select pg_temp.form_read('23000000-0000-4000-8000-000000000003')$$,'42501','Forbidden','cross-tenant form read denied');
select throws_ok($$select pg_temp.form_publish('23000000-0000-4000-8000-000000000003')$$,'42501','Forbidden','cross-tenant publish denied');
select throws_ok($$select pg_temp.form_publish(fields=>'[{"key":"passport","required":true}]')$$,'22023','Invalid visitor form','identity fields blocked');
select throws_ok($$select pg_temp.form_publish(fields=>'[{"key":"contact_phone","required":true}]')$$,'22023','Invalid visitor form','unreviewed phone field blocked');
select throws_ok($$select pg_temp.form_publish(fields=>'[{"key":"purpose","required":"true"}]')$$,'22023','Invalid visitor form','schema types enforced');
select throws_ok($$select pg_temp.form_publish(fields=>'[{"key":"purpose","required":true,"label":"National ID"}]')$$,'22023','Invalid visitor form','arbitrary label cannot bypass catalog');
select throws_ok($$select pg_temp.form_publish(fields=>'[{"key":"purpose","required":true},{"key":"purpose","required":false}]')$$,'22023','Invalid visitor form','duplicate field blocked');
insert into forms_ctx values('v1',pg_temp.form_publish());
select is((select (data->>'version')::int from forms_ctx where name='v1'),1,'first version published');
select is(pg_temp.form_publish()->>'id',(select data->>'id' from forms_ctx where name='v1'),'same publish request is idempotent');
select throws_ok($$select pg_temp.form_publish(title=>'Different payload')$$,'22023','Publish request conflict','same request cannot carry changed payload');
select throws_ok($$select pg_temp.form_publish(r=>'33000000-0000-4000-8000-000000000002')$$,'22023','Form changed; reload before publishing','stale editor rejected');
select is(jsonb_array_length(pg_temp.form_read()->'history'),1,'retry did not create duplicate version');
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000003',true);
select throws_ok($$select pg_temp.form_publish()$$,'42501','Forbidden','guard cannot publish');
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000001',true);
insert into forms_ctx values('invite',public.create_invitation('23000000-0000-4000-8000-000000000001'));
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000002',true);
insert into forms_ctx select 'v2',pg_temp.form_publish(r=>'33000000-0000-4000-8000-000000000002',expected=>(select (data->>'id')::uuid from forms_ctx where name='v1'),fields=>'[{"key":"party_size","required":true}]');
select is((pg_temp.form_read()->'active'->>'version')::int,2,'next version becomes active');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
select is((public.resolve_visitor_invitation((select data->>'token' from forms_ctx where name='invite'))->'form'->>'version')::int,1,'invitation stays pinned to previous form');
select ok(not(public.resolve_visitor_invitation((select data->>'token' from forms_ctx where name='invite')) ?| array['owner_id','token_hash','tenant_id','site_id']),'public resolution exposes minimal metadata');
select throws_ok($$select public.resolve_visitor_invitation('invalid')$$,'P0001','Invitation unavailable','invalid token uniform error');
select throws_ok($$select public.redeem_invitation((select data->>'token' from forms_ctx where name='invite'),'Bypass',true)$$,'22023','Invalid visitor answers','legacy RPC cannot skip required fields');
select throws_ok($$select pg_temp.guest_submit('{"purpose":"Delivery","safety_ack":false}')$$,'22023','Invalid visitor answers','required checkbox must be true');
select throws_ok($$select pg_temp.guest_submit('{"purpose":"Delivery","safety_ack":true,"company":5}')$$,'22023','Invalid visitor answers','answer types enforced');
select throws_ok($$select pg_temp.guest_submit('{"purpose":"Delivery","safety_ack":true,"passport":"x"}')$$,'22023','Invalid visitor answers','extra answer keys rejected');
select throws_ok($$select public.submit_visitor_registration((select data->>'token' from forms_ctx where name='invite'),'Fictional',false,'{}')$$,'P0001','Invalid registration','notice required');
select lives_ok($$select public.resolve_visitor_invitation((select data->>'token' from forms_ctx where name='invite'))$$,'invalid submissions do not consume token');
insert into forms_ctx select 'visit',to_jsonb(pg_temp.guest_submit());
select throws_ok($$select pg_temp.guest_submit()$$,'P0001','Invitation unavailable','registration replay rejected');
select throws_ok($$select public.resolve_visitor_invitation((select data->>'token' from forms_ctx where name='invite'))$$,'P0001','Invitation unavailable','used token no longer resolves');
select lives_ok($$select public.redeem_invitation((select data->>'token' from forms_ctx where name='legacy'),'Fictional legacy guest',true)$$,'pre-form name-only invitation remains valid');
select throws_ok($$select * from public.visitor_form_responses$$,'42501',null,'anonymous cannot read raw answers');
select throws_ok($$select * from public.visitor_form_versions$$,'42501',null,'anonymous cannot enumerate forms');
set local role authenticated;
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000001',true);
select is((public.get_visit_form_response((select (data#>>'{}')::uuid from forms_ctx where name='visit'))->'form'->>'version')::int,1,'owner sees submitted historical schema');
select throws_ok($$select * from public.visitor_form_responses$$,'42501',null,'owner cannot bypass audited answer RPC');
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000004',true);
select throws_ok($$select public.get_visit_form_response((select (data#>>'{}')::uuid from forms_ctx where name='visit'))$$,'42501','Forbidden','operator has no implicit answer access');
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000005',true);
select throws_ok($$select public.get_visit_form_response((select (data#>>'{}')::uuid from forms_ctx where name='visit'))$$,'42501','Forbidden','foreign tenant manager denied answers');
select set_config('request.jwt.claim.sub','03000000-0000-4000-8000-000000000003',true);
select is(public.get_visit_form_response((select (data#>>'{}')::uuid from forms_ctx where name='visit'))->'answers'->>'company','Fictional company','guard reads correct historical answers');
select throws_ok($$update public.visitor_form_versions set title='Tampered'$$,'42501',null,'client cannot mutate version table');
reset role;
select ok(exists(select 1 from public.audit_events where action='visitor.answers.read' and actor='03000000-0000-4000-8000-000000000003'),'answer read audited');
select throws_ok($$update public.visitor_form_versions set title='Tampered' where id=(select (data->>'id')::uuid from forms_ctx where name='v1')$$,'23514','Published form versions are immutable','versions immutable even through direct writes');
select throws_ok($$update public.invitations set form_version_id=(select (data->>'id')::uuid from forms_ctx where name='v2') where id=(select (data->>'id')::uuid from forms_ctx where name='invite')$$,'23514','Invitation form is immutable','issued invitation cannot switch version');
select throws_ok($$update public.visitor_form_responses set form_version_id=(select (data->>'id')::uuid from forms_ctx where name='v2') where visit_id=(select (data#>>'{}')::uuid from forms_ctx where name='visit')$$,'23514','Response form does not match invitation','response version is tied to invitation');
select ok(private.valid_visitor_answers('[{"key":"arrival_date","required":true}]','{"arrival_date":"2028-02-29"}'),'valid leap date');
select ok(not private.valid_visitor_answers('[{"key":"arrival_date","required":true}]','{"arrival_date":"2026-02-29"}'),'invalid calendar date');
select ok(not private.valid_visitor_answers('[{"key":"party_size","required":true}]','{"party_size":1.5}'),'numeric answer must be integer');
select ok(not private.valid_visitor_answers('[{"key":"party_size","required":true}]','{"party_size":21}'),'numeric answer bounded');
update public.visits set created_at=now()-interval '31 days' where id=(select (data#>>'{}')::uuid from forms_ctx where name='visit');
select private.retain();
select is((select answers from public.visitor_form_responses where visit_id=(select (data#>>'{}')::uuid from forms_ctx where name='visit')),'{}'::jsonb,'retention clears answers');
select ok((select anonymized_at is not null from public.visitor_form_responses where visit_id=(select (data#>>'{}')::uuid from forms_ctx where name='visit')),'retention records anonymization');
select is((select count(*)::int from public.visitor_form_versions where site_id='23000000-0000-4000-8000-000000000001'),2,'retention preserves historical schemas');
select is((select count(*)::int from pg_tables where schemaname='public' and tablename in ('visitor_form_versions','visitor_form_responses') and rowsecurity),2,'both new tables enforce RLS');
select * from finish();
rollback;

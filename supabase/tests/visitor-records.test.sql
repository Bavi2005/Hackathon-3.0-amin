-- Transactional fictional fixtures; requires all migrations and a dedicated test project.
begin;
create extension if not exists pgtap with schema extensions;
select plan(36);
insert into auth.users(id) values
 ('02000000-0000-4000-8000-000000000001'),('02000000-0000-4000-8000-000000000002'),
 ('02000000-0000-4000-8000-000000000003'),('02000000-0000-4000-8000-000000000004');
insert into public.tenants(id,name,demo) values
 ('12000000-0000-4000-8000-000000000001','Records test',true),
 ('12000000-0000-4000-8000-000000000002','Unrelated records test',true);
insert into public.sites(id,tenant_id,name) values
 ('22000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','Records site'),
 ('22000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000001','Other site'),
 ('22000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000002','Other tenant');
insert into public.memberships(tenant_id,site_id,user_id,role,capabilities) values
 ('12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','RESIDENT',array['visits.invite']),
 ('12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000002','SITE_MANAGER',array['visits.read.site','exports.visits','audit.read']),
 ('12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000003','STAFF',array['visits.read.site','visits.checkin']),
 ('12000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000003','02000000-0000-4000-8000-000000000004','RESIDENT',array['visits.invite']);
insert into public.invitations(id,tenant_id,site_id,owner_id,token_hash,expires_at) values
 ('32000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','records-test-one',now()+interval '1 day'),
 ('32000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','records-test-two',now()+interval '1 day'),
 ('32000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000003','02000000-0000-4000-8000-000000000004','records-test-three',now()+interval '1 day');
insert into public.visits(id,tenant_id,site_id,owner_id,invitation_id,guest_name,status,created_at) values
 ('42000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','Fictional Alpha','pending_entry','2026-10-20T00:00:00Z'),
 ('42000000-0000-4000-8000-000000000002','12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000002','Fictional Beta','onsite','2026-10-20T00:00:00Z'),
 ('42000000-0000-4000-8000-000000000003','12000000-0000-4000-8000-000000000002','22000000-0000-4000-8000-000000000003','02000000-0000-4000-8000-000000000004','32000000-0000-4000-8000-000000000003','Unrelated Guest','pending_entry','2026-10-20T00:00:00Z');

create function pg_temp.search_records(s uuid default '22000000-0000-4000-8000-000000000001',
 q text default '',status text default 'all',lim int default 25,off int default 0) returns jsonb language sql as $$
 select public.search_visitor_records(s,'2026-10-19T16:00:00Z','2026-10-20T16:00:00Z',status,q,lim,off)
$$;
create function pg_temp.export_records(s uuid default '22000000-0000-4000-8000-000000000001',reason text default 'operations_review') returns jsonb language sql as $$
 select public.export_visitor_records(s,'2026-10-19T16:00:00Z','2026-10-20T16:00:00Z',reason)
$$;
set local role anon;
select throws_ok($$select pg_temp.search_records()$$,'42501',null,'anonymous cannot search');
select throws_ok($$select pg_temp.export_records()$$,'42501',null,'anonymous cannot export');
set local role authenticated;
select set_config('request.jwt.claim.sub','02000000-0000-4000-8000-000000000001',true);
select throws_ok($$select pg_temp.search_records()$$,'42501','Forbidden','resident cannot search site records');
select throws_ok($$select pg_temp.export_records()$$,'42501','Forbidden','resident cannot export');
select set_config('request.jwt.claim.sub','02000000-0000-4000-8000-000000000003',true);
select is(jsonb_array_length(pg_temp.search_records()->'records'),2,'guard can search scoped records');
select throws_ok($$select pg_temp.export_records()$$,'42501','Forbidden','guard does not inherit export');
select set_config('request.jwt.claim.sub','02000000-0000-4000-8000-000000000002',true);
select throws_ok($$select pg_temp.search_records('22000000-0000-4000-8000-000000000002')$$,'42501','Forbidden','cross-site search denied');
select throws_ok($$select pg_temp.export_records('22000000-0000-4000-8000-000000000002')$$,'42501','Forbidden','cross-site export denied');
select throws_ok($$select pg_temp.search_records('22000000-0000-4000-8000-000000000003')$$,'42501','Forbidden','cross-tenant search denied');
select throws_ok($$select pg_temp.export_records('22000000-0000-4000-8000-000000000003')$$,'42501','Forbidden','cross-tenant export denied');
select throws_ok($$select pg_temp.search_records('22000000-0000-4000-8000-000000000099')$$,'42501','Forbidden','missing site is also forbidden');
select is(jsonb_array_length(pg_temp.search_records()->'records'),2,'manager sees only own site');
select is(pg_temp.search_records()->'records'->0->>'masked_name','F***','search masks name');
select ok(not ((pg_temp.search_records()->'records'->0) ?| array['guest_name','owner_id','invitation_id','token_hash','tenant_id']),'search allowlists output fields');
select is(jsonb_array_length(pg_temp.search_records(q=>'alpha')->'records'),1,'literal case-insensitive name search');
select is(jsonb_array_length(pg_temp.search_records(q=>'42000000-0000-4000-8000-000000000001')->'records'),1,'reference search');
select is(jsonb_array_length(pg_temp.search_records(q=>'%')->'records'),0,'wildcard is literal');
select is(jsonb_array_length(pg_temp.search_records(status=>'onsite')->'records'),1,'status filter');
select is(pg_temp.search_records(lim=>1)->>'has_more','true','pagination signals more');
select is(pg_temp.search_records(lim=>1,off=>1)->'records'->0->>'id','42000000-0000-4000-8000-000000000001','tied timestamps use deterministic ID ordering');
select throws_ok($$select pg_temp.search_records(lim=>101)$$,'22023','Invalid visitor filters','page size bounded');
select throws_ok($$select pg_temp.search_records(off=>-1)$$,'22023','Invalid visitor filters','offset bounded');
select throws_ok($$select pg_temp.search_records(q=>repeat('x',81))$$,'22023','Invalid visitor filters','search length bounded');
select throws_ok($$select pg_temp.search_records(status=>'anything')$$,'22023','Invalid visitor filters','status allowlist');
select throws_ok($$select public.search_visitor_records('22000000-0000-4000-8000-000000000001','2026-01-01','2026-03-01')$$,'22023','Invalid visitor filters','date span bounded');
select throws_ok($$select public.search_visitor_records('22000000-0000-4000-8000-000000000001','-infinity','infinity')$$,'22023','Invalid visitor filters','infinite dates rejected');
select throws_ok($$select pg_temp.export_records(reason=>'free text with personal data')$$,'22023','Choose an export purpose','purpose allowlist');
select is((pg_temp.export_records()->>'count')::int,2,'export count reflects actual matching rows');
select ok(exists(select 1 from public.audit_events where action='visitors.exported' and actor=auth.uid() and metadata->>'reason'='operations_review' and metadata->>'count'='2'),'export is audited with actor purpose and count');
select ok(not exists(select 1 from public.audit_events where metadata::text like '%Fictional%' or metadata ? 'query'),'no search term or name in audit');
select throws_ok($$select private.visitor_records('22000000-0000-4000-8000-000000000001',now()-interval '1 day',now(),'all','',1,0)$$,'42501',null,'cannot bypass RPC via private helper');
reset role;
update public.memberships set capabilities=array['exports.visits'] where user_id='02000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select pg_temp.export_records()$$,'42501','Forbidden','export also requires site read grant');
reset role;
update public.memberships set capabilities=array['visits.read.site','exports.visits'],active=false where user_id='02000000-0000-4000-8000-000000000002';
set local role authenticated;
select throws_ok($$select pg_temp.export_records()$$,'42501','Forbidden','inactive membership denied');
reset role;
update public.memberships set active=true where user_id='02000000-0000-4000-8000-000000000002';
with invites as (
 insert into public.invitations(tenant_id,site_id,owner_id,token_hash,expires_at)
 select '12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000001','bulk-records-'||g,now()+interval '1 day' from generate_series(1,1000) g returning *
)
insert into public.visits(tenant_id,site_id,owner_id,invitation_id,guest_name,created_at)
select tenant_id,site_id,owner_id,id,'Fictional bulk guest','2026-10-20T00:00:00Z' from invites;
set local role authenticated;
select throws_ok($$select pg_temp.export_records()$$,'22023','Too many records; narrow the filters','oversized export fails without truncating');
reset role;
insert into public.audit_events(tenant_id,site_id,actor,action)
select '12000000-0000-4000-8000-000000000001','22000000-0000-4000-8000-000000000001','02000000-0000-4000-8000-000000000002','visitors.exported' from generate_series(1,9);
set local role authenticated;
select throws_ok($$select pg_temp.export_records()$$,'P0001','Export rate limit','ten exports per hour enforced');
select throws_ok($$delete from public.audit_events where action='visitors.exported'$$,'42501',null,'client cannot erase export audit');
reset role;
select * from finish();
rollback;

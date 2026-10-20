begin;
create extension if not exists pgtap with schema extensions;
select plan(30);
insert into auth.users(id) values ('05000000-0000-4000-8000-000000000001'),('05000000-0000-4000-8000-000000000002'),('05000000-0000-4000-8000-000000000003'),('05000000-0000-4000-8000-000000000004');
insert into public.tenants(id,name,demo) values ('15000000-0000-4000-8000-000000000001','Admin fictional tenant',true),('15000000-0000-4000-8000-000000000002','Other admin tenant',true);
insert into public.sites(id,tenant_id,name) values
 ('25000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001','Admin site'),
 ('25000000-0000-4000-8000-000000000002','15000000-0000-4000-8000-000000000002','Other admin site');
insert into public.memberships(id,tenant_id,site_id,user_id,role,capabilities) values
 ('35000000-0000-4000-8000-000000000001','15000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','05000000-0000-4000-8000-000000000001','SITE_MANAGER',array['staff.manage','staff.invite','fleet.configure','parking.configure']),
 ('35000000-0000-4000-8000-000000000002','15000000-0000-4000-8000-000000000001','25000000-0000-4000-8000-000000000001','05000000-0000-4000-8000-000000000002','RESIDENT',array['visits.invite']),
 ('35000000-0000-4000-8000-000000000003','15000000-0000-4000-8000-000000000002','25000000-0000-4000-8000-000000000002','05000000-0000-4000-8000-000000000003','SITE_MANAGER',array['staff.manage','staff.invite','fleet.configure','parking.configure']);
create temp table admin_ctx(name text primary key,data jsonb);
grant all on admin_ctx to authenticated;
create function pg_temp.admin_read(s uuid default '25000000-0000-4000-8000-000000000001') returns jsonb language sql as $$select public.get_site_administration(s)$$;
create function pg_temp.staff_invite(t text default 'driver',r uuid default '45000000-0000-4000-8000-000000000001') returns jsonb language sql as $$
 select public.invite_site_staff('25000000-0000-4000-8000-000000000001',r,'05000000-0000-4000-8000-000000000004',t)
$$;
create function pg_temp.vehicle_save(expected int default 0,capacity int default 2,driver uuid default '05000000-0000-4000-8000-000000000004') returns uuid language sql as $$
 select public.save_site_vehicle('25000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001',expected,'Fictional shuttle',capacity,true,driver)
$$;
update private.runtime_settings set environment='production',simulations_enabled=false;
set local role anon;
select throws_ok($$select pg_temp.admin_read()$$,'42501',null,'anonymous administration denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000002',true);
select throws_ok($$select pg_temp.admin_read()$$,'42501','Forbidden','resident directory denied');
select throws_ok($$select pg_temp.staff_invite()$$,'42501','Forbidden','resident cannot delegate');
select throws_ok($$select pg_temp.vehicle_save()$$,'42501','Forbidden','resident cannot configure fleet');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000003',true);
select throws_ok($$select pg_temp.admin_read()$$,'42501','Forbidden','foreign manager denied');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000001',true);
select throws_ok($$select pg_temp.admin_read('25000000-0000-4000-8000-000000000002')$$,'42501','Forbidden','manager foreign site denied');
select throws_ok($$select pg_temp.staff_invite()$$,'42501','Multi-factor step-up required','production staff changes require MFA');
reset role;
update private.runtime_settings set environment='test',simulations_enabled=true;
set local role authenticated;
select throws_ok($$select pg_temp.staff_invite('TOWNSHIP_ADMIN')$$,'22023','Invalid staff invitation','cannot invite administrative role');
insert into admin_ctx values('invite',pg_temp.staff_invite());
select ok((select data->>'token' from admin_ctx where name='invite')~'^[a-f0-9]{64}$','staff token is opaque random reference');
select is(pg_temp.staff_invite()->'token','null'::jsonb,'staff invite retry never leaks stored bearer token');
select throws_ok($$select pg_temp.staff_invite('guard')$$,'22023','Invitation request conflict','same request cannot change grant');
select ok(not((pg_temp.admin_read()->'invitations'->0) ? 'token_hash'),'management never returns token hash');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000002',true);
select throws_ok($$select public.accept_staff_invitation((select data->>'token' from admin_ctx where name='invite'))$$,'42501','Staff invitation unavailable','wrong account cannot accept');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000004',true);
insert into admin_ctx select 'membership',to_jsonb(public.accept_staff_invitation((select data->>'token' from admin_ctx where name='invite')));
select is((select role from public.memberships where user_id=auth.uid()),'DRIVER','accepted role is delegated template only');
select throws_ok($$select public.accept_staff_invitation((select data->>'token' from admin_ctx where name='invite'))$$,'42501','Staff invitation unavailable','accepted invitation cannot replay');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000001',true);
select throws_ok($$select public.set_staff_membership('25000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000001',1,'guard',false)$$,'42501','Only other delegated staff memberships can be changed','manager cannot alter own administrative membership');
select throws_ok($$select pg_temp.vehicle_save(capacity=>0)$$,'22023','Invalid vehicle','vehicle capacity positive');
select throws_ok($$select pg_temp.vehicle_save(driver=>'05000000-0000-4000-8000-000000000003')$$,'22023','Driver must have active driving capability at this site','foreign driver rejected');
select lives_ok($$select pg_temp.vehicle_save()$$,'scoped vehicle created');
select lives_ok($$select pg_temp.vehicle_save()$$,'vehicle create retry is idempotent');
select throws_ok($$select pg_temp.vehicle_save(expected=>0,capacity=>3)$$,'22023','Vehicle changed; reload before saving','stale vehicle update rejected');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000004',true);
select public.set_shift('55000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000001',true);
select throws_ok($$select pg_temp.vehicle_save(expected=>1)$$,'22023','End active shifts and rides before editing vehicle','active vehicle cannot be edited');
select throws_ok($$select public.set_staff_membership('25000000-0000-4000-8000-000000000001',(select (data#>>'{}')::uuid from admin_ctx where name='membership'),1,'driver',false)$$,'22023','End assigned shifts before changing this membership','cannot strand active driver');
select lives_ok($$select public.save_parking_zone('25000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000001',0,'Fictional zone',40)$$,'parking zone created');
select throws_ok($$select public.save_parking_device('25000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',0,gen_random_uuid(),true)$$,'22023','Invalid parking device or zone','foreign or nonexistent device zone denied');
select lives_ok($$select public.save_parking_device('25000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',0,'65000000-0000-4000-8000-000000000001',false)$$,'suspended registry device created');
select throws_ok($$select * from private.staff_invitations$$,'42501',null,'client cannot read invitation secrets');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000004',true);
select public.set_shift('55000000-0000-4000-8000-000000000001',false);
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000001',true);
select lives_ok($$select public.set_staff_membership('25000000-0000-4000-8000-000000000001',(select (data#>>'{}')::uuid from admin_ctx where name='membership'),1,'driver',false)$$,'off-shift membership can be disabled');
select set_config('request.jwt.claim.sub','05000000-0000-4000-8000-000000000004',true);
select is((select count(*)::int from public.sites),0,'disabled membership immediately loses site access');
select throws_ok($$select public.set_shift('55000000-0000-4000-8000-000000000001',true)$$,'42501','Forbidden','disabled driver cannot start shift');
select * from finish();
rollback;

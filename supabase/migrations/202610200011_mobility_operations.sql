alter table public.rides add column assigned_at timestamptz;
alter table public.rides add column boarded_at timestamptz;
alter table public.rides add column completed_at timestamptz;
alter table public.rides add column cancelled_at timestamptz;
create table public.transport_routes(
 id uuid primary key,tenant_id uuid not null,site_id uuid not null,name text not null check(length(btrim(name)) between 1 and 80),
 stop_names text[] not null check(cardinality(stop_names) between 2 and 20),
 start_minute int not null check(start_minute between 0 and 1439),end_minute int not null check(end_minute between 1 and 1440),
 headway_minutes int not null check(headway_minutes between 1 and 180),published boolean not null default false,
 revision int not null default 1,check(end_minute>start_minute),foreign key(tenant_id,site_id) references public.sites(tenant_id,id)
);
alter table public.transport_routes enable row level security;
revoke all on public.transport_routes from public,anon,authenticated;
grant select on public.transport_routes to authenticated;
create policy route_read on public.transport_routes for select to authenticated using(private.allowed(tenant_id,site_id) and (published or private.allowed(tenant_id,site_id,'fleet.configure')));
create table private.dispatch_decisions(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,ride_id uuid not null,vehicle_id uuid not null,
 previous_vehicle_id uuid,actor uuid not null references auth.users,reason text not null,alternative_count int not null check(alternative_count>=0),
 created_at timestamptz not null default now(),
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id),
 foreign key(tenant_id,site_id,vehicle_id) references public.vehicles(tenant_id,site_id,id)
);
alter table public.rides add unique(tenant_id,site_id,id);
alter table private.dispatch_decisions add foreign key(tenant_id,site_id,ride_id) references public.rides(tenant_id,site_id,id);
alter table private.dispatch_decisions add foreign key(tenant_id,site_id,previous_vehicle_id) references public.vehicles(tenant_id,site_id,id);
alter table private.dispatch_decisions enable row level security;
revoke all on private.dispatch_decisions from public,anon,authenticated;

create function public.save_transport_route(p_site uuid,p_id uuid,p_expected int,p_name text,p_stops text[],p_start int,p_end int,p_headway int,p_published boolean) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.sites; r public.transport_routes;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'fleet.configure') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_name is null or length(btrim(p_name)) not between 1 and 80 or p_stops is null or cardinality(p_stops) not between 2 and 20
 or p_start is null or p_end is null or p_headway is null or p_published is null or p_start not between 0 and 1439 or p_end not between p_start+1 and 1440 or p_headway not between 1 and 180
 or exists(select 1 from unnest(p_stops) n where not exists(select 1 from public.stops where site_id=s.id and name=n))
 or (select count(distinct n) from unnest(p_stops) n)<2 then raise exception 'Invalid route or timetable' using errcode='22023'; end if;
 select * into r from public.transport_routes where id=p_id for update;
 if r.id is not null and r.site_id<>s.id then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_expected=0 and r.revision=1 and r.name=btrim(p_name) and r.stop_names=p_stops and r.start_minute=p_start and r.end_minute=p_end and r.headway_minutes=p_headway and r.published=p_published then return r.id; end if;
 if coalesce(r.revision,0) is distinct from p_expected then raise exception 'Route changed; reload before saving' using errcode='22023'; end if;
 insert into public.transport_routes(id,tenant_id,site_id,name,stop_names,start_minute,end_minute,headway_minutes,published)
 values(p_id,s.tenant_id,s.id,btrim(p_name),p_stops,p_start,p_end,p_headway,p_published)
 on conflict(id) do update set name=excluded.name,stop_names=excluded.stop_names,start_minute=excluded.start_minute,end_minute=excluded.end_minute,headway_minutes=excluded.headway_minutes,published=excluded.published,revision=transport_routes.revision+1;
 perform private.audit(s.tenant_id,s.id,'transport.route.saved',p_id);return p_id;
end$$;
revoke all on function public.save_transport_route(uuid,uuid,int,text,text[],int,int,int,boolean) from public,anon,authenticated;
grant execute on function public.save_transport_route(uuid,uuid,int,text,text[],int,int,int,boolean) to authenticated;

create function private.dispatch_candidates(p_ride uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'name',v.name,'capacity',v.capacity,'occupied',v.occupied,'spare',v.capacity-v.occupied,
 'accessible',v.accessible,'eta_minutes',null,'quality','ETA unavailable; routing provider not configured',
 'reason','Compatible active vehicle; ranked by spare capacity') order by v.capacity-v.occupied desc,v.id),'[]'::jsonb)
 from (select v.*, (select count(*) from public.rides where vehicle_id=v.id and status in ('assigned','boarded')) occupied
 from public.vehicles v join public.rides r on r.id=p_ride and v.site_id=r.site_id and v.tenant_id=r.tenant_id
 where v.shift_active and (not r.accessible or v.accessible) and exists(select 1 from public.memberships m where m.user_id=v.driver_id and m.site_id=v.site_id and m.active and 'fleet.drive'=any(m.capabilities))) v
 where v.occupied<v.capacity
$$;
revoke all on function private.dispatch_candidates(uuid) from public,anon,authenticated;
create function public.get_dispatch_recommendations(p_ride uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.rides;
begin
 select * into r from public.rides where id=p_ride;
 if not private.allowed(r.tenant_id,r.site_id,'fleet.dispatch') then raise exception 'Forbidden' using errcode='42501'; end if;
 if r.status not in ('requested','assigned') then raise exception 'Ride is no longer dispatchable' using errcode='22023'; end if;
 return jsonb_build_object('candidates',private.dispatch_candidates(r.id),'generated_at',now(),'quality','Capacity-only recommendation; no route ETA available');
end$$;
revoke all on function public.get_dispatch_recommendations(uuid) from public,anon,authenticated;
grant execute on function public.get_dispatch_recommendations(uuid) to authenticated;

create or replace function public.assign_ride(p_ride uuid,p_vehicle uuid) returns void language plpgsql security definer set search_path='' as $$
declare r public.rides; v public.vehicles; alternatives int;
begin
 perform 1 from public.sites where id=(select site_id from public.vehicles where id=p_vehicle) for share;
 select * into v from public.vehicles where id=p_vehicle for update;
 if not private.allowed(v.tenant_id,v.site_id,'fleet.dispatch') then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into r from public.rides where id=p_ride for update;
 if r.vehicle_id=v.id and r.status='assigned' then return; end if;
 if r.id is null or r.tenant_id<>v.tenant_id or r.site_id<>v.site_id or r.status<>'requested' or not v.shift_active or (r.accessible and not v.accessible)
 or not exists(select 1 from public.memberships where user_id=v.driver_id and site_id=v.site_id and active and 'fleet.drive'=any(capabilities)) then raise exception 'Incompatible assignment'; end if;
 if (select count(*) from public.rides where vehicle_id=v.id and status in ('assigned','boarded'))>=v.capacity then raise exception 'Vehicle full'; end if;
 alternatives:=greatest(0,jsonb_array_length(private.dispatch_candidates(r.id))-1);
 update public.rides set vehicle_id=v.id,status='assigned',assigned_at=now(),updated_at=now() where id=r.id;
 insert into private.dispatch_decisions(tenant_id,site_id,ride_id,vehicle_id,actor,reason,alternative_count)
 values(r.tenant_id,r.site_id,r.id,v.id,auth.uid(),'manual_capacity_checked',alternatives);
 perform private.audit(r.tenant_id,r.site_id,'dispatch.manual.capacity-checked',r.id);
end$$;

create function public.reassign_ride(p_ride uuid,p_vehicle uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.rides; v public.vehicles; alternatives int;
begin
 -- Exclusive site lock serializes multi-vehicle reassignment with ordinary assignments.
 perform 1 from public.sites where id=(select site_id from public.rides where id=p_ride) for update;
 select * into r from public.rides where id=p_ride;
 if not private.allowed(r.tenant_id,r.site_id,'fleet.dispatch') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_reason is null or p_reason not in ('vehicle_offline','operational_change','accessibility') then raise exception 'Reassignment reason required' using errcode='22023'; end if;
 perform 1 from public.vehicles where id in (r.vehicle_id,p_vehicle) order by id for update;
 select * into r from public.rides where id=p_ride for update;
 select * into v from public.vehicles where id=p_vehicle;
 if r.vehicle_id=v.id and r.status='assigned' then return; end if;
 if r.status<>'assigned' or v.id is null or r.site_id<>v.site_id or r.tenant_id<>v.tenant_id or not v.shift_active or (r.accessible and not v.accessible)
 or not exists(select 1 from public.memberships where user_id=v.driver_id and site_id=v.site_id and active and 'fleet.drive'=any(capabilities)) then raise exception 'Incompatible reassignment' using errcode='22023'; end if;
 if (select count(*) from public.rides where vehicle_id=v.id and status in ('assigned','boarded'))>=v.capacity then raise exception 'Vehicle full'; end if;
 alternatives:=greatest(0,jsonb_array_length(private.dispatch_candidates(r.id))-1);
 insert into private.dispatch_decisions(tenant_id,site_id,ride_id,vehicle_id,previous_vehicle_id,actor,reason,alternative_count)
 values(r.tenant_id,r.site_id,r.id,v.id,r.vehicle_id,auth.uid(),p_reason,alternatives);
 update public.rides set vehicle_id=v.id,updated_at=now() where id=r.id;
 perform private.audit(r.tenant_id,r.site_id,'dispatch.reassigned.'||p_reason,r.id);
end$$;
revoke all on function public.reassign_ride(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.reassign_ride(uuid,uuid,text) to authenticated;

create or replace function public.ride_transition(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.rides; v public.vehicles;
begin
 select * into r from public.rides where id=p_id for update;
 if not private.allowed(r.tenant_id,r.site_id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select * into v from public.vehicles where id=r.vehicle_id;
 if p_status='cancelled' and r.resident_id=auth.uid() and r.status in ('requested','assigned') then null;
 elsif v.driver_id=auth.uid() and v.shift_active and private.allowed(r.tenant_id,r.site_id,'fleet.drive') and ((r.status='assigned' and p_status='boarded') or (r.status='boarded' and p_status='completed')) then null;
 else raise exception 'Forbidden transition' using errcode='42501'; end if;
 update public.rides set status=p_status,updated_at=now(),boarded_at=case when p_status='boarded' then now() else boarded_at end,
 completed_at=case when p_status='completed' then now() else completed_at end,cancelled_at=case when p_status='cancelled' then now() else cancelled_at end where id=r.id;
 perform private.audit(r.tenant_id,r.site_id,'ride.'||p_status,r.id);
end$$;

-- Tighten idempotency: a request key may not silently change rider input.
create or replace function public.request_ride(p_id uuid,p_site uuid,p_pickup text,p_destination text,p_accessible boolean default false) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.sites; existing public.rides;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id,'rides.request') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_accessible is null or p_pickup is null or p_destination is null or p_pickup=p_destination
 or not exists(select 1 from public.stops where tenant_id=s.tenant_id and site_id=s.id and name=p_pickup)
 or not exists(select 1 from public.stops where tenant_id=s.tenant_id and site_id=s.id and name=p_destination) then raise exception 'Choose two configured service stops'; end if;
 perform 1 from public.memberships where user_id=auth.uid() and site_id=p_site for update;
 select * into existing from public.rides where id=p_id;
 if found then
   if existing.resident_id<>auth.uid() or existing.site_id<>p_site or existing.pickup<>p_pickup or existing.destination<>p_destination or existing.accessible<>p_accessible then
     raise exception 'Ride request conflict' using errcode='22023'; end if;
   return p_id;
 end if;
 if p_accessible and not exists(select 1 from public.vehicles where site_id=s.id and accessible) then raise exception 'No accessible vehicle is configured for this site' using errcode='22023'; end if;
 if (select count(*) from public.rides where resident_id=auth.uid() and status in ('requested','assigned','boarded'))>=3 then raise exception 'Active ride limit'; end if;
 insert into public.rides(id,tenant_id,site_id,resident_id,pickup,destination,accessible) values(p_id,s.tenant_id,s.id,auth.uid(),p_pickup,p_destination,p_accessible);
 perform private.audit(s.tenant_id,s.id,'ride.requested',p_id);return p_id;
end$$;

alter table public.parking_zones add constraint observation_has_count check((occupied is null)=(observed_at is null));
alter table public.invitations add constraint invitation_owner_site foreign key(owner_id,site_id) references public.memberships(user_id,site_id);
alter table public.rides add constraint rider_membership_site foreign key(resident_id,site_id) references public.memberships(user_id,site_id);
alter table public.vehicles add constraint driver_membership_site foreign key(driver_id,site_id) references public.memberships(user_id,site_id);
create index visits_site_created on public.visits(site_id,created_at desc);
create index rides_site_created on public.rides(site_id,created_at desc);
create index events_retention on public.iot_events(created_at);

-- Idempotent shift start must not clear telemetry timestamps and bypass GPS throttling.
create or replace function public.set_shift(p_vehicle uuid,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
declare v public.vehicles;
begin
 select * into v from public.vehicles where id=p_vehicle for update;
 if v.driver_id is distinct from auth.uid() or not private.allowed(v.tenant_id,v.site_id,'fleet.drive') then raise exception 'Forbidden' using errcode='42501';end if;
 if p_active is null then raise exception 'Invalid shift state';end if;
 if p_active=v.shift_active then return;end if;
 if not p_active and exists(select 1 from public.rides where vehicle_id=v.id and status in ('assigned','boarded')) then raise exception 'Complete active rides first';end if;
 update public.vehicles set shift_active=p_active,lat=null,lng=null,accuracy=null,observed_at=null where id=v.id;
 perform private.audit(v.tenant_id,v.site_id,'shift.'||p_active::text,v.id);
end$$;

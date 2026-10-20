-- Database invariants protect even trusted provisioners from accidental mixed-site links.
alter table public.invitations add unique(tenant_id,site_id,id);
alter table public.visits add constraint visit_invitation_site foreign key(tenant_id,site_id,invitation_id) references public.invitations(tenant_id,site_id,id);
alter table public.iot_devices add unique(tenant_id,site_id,id);
alter table public.iot_events add constraint event_device_site foreign key(tenant_id,site_id,device_id) references public.iot_devices(tenant_id,site_id,id);
alter table public.visits add constraint visit_time_order check((entered_at is null or entered_at>=created_at) and (exited_at is null or (entered_at is not null and exited_at>=entered_at)));
alter table public.rides add constraint distinct_stops check(pickup<>destination);
alter table public.rides add constraint pickup_service foreign key(tenant_id,site_id,pickup) references public.stops(tenant_id,site_id,name);
alter table public.rides add constraint destination_service foreign key(tenant_id,site_id,destination) references public.stops(tenant_id,site_id,name);

-- Preserve one active bay-loading record per vehicle/site, even under concurrent desk requests.
create unique index loading_one_active_vehicle on private.loading_sessions(site_id,vehicle_ref) where status='loading';
create index loading_sessions_creator on private.loading_sessions(created_by);
create index loading_sessions_facility_fk on private.loading_sessions(tenant_id,site_id,facility_id);
create index loading_sessions_level_fk on private.loading_sessions(tenant_id,site_id,level_id);
-- Loading logs contain vehicle identifiers. Purge old departures and abandoned sessions after 30 days.
-- Do not replace the existing visitor retention/legal-hold controls.
alter function private.retain() rename to retain_before_loading;
create function private.retain() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.retain_before_loading();
 delete from private.loading_sessions where checked_in_at < now()-interval '30 days';
end$$;
revoke all on function private.retain() from public,anon,authenticated;

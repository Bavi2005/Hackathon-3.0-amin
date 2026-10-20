-- Refresh-safe confirmation is purpose-limited and never exposes names/answers.
create function public.get_visitor_confirmation(p_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare i public.invitations; v public.visits; site_name text;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' then raise exception 'Confirmation unavailable'; end if;
 select * into i from public.invitations where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 if i.id is null or i.redeemed_at is null or least(i.expires_at,i.redeemed_at+interval '1 hour')<=now() then raise exception 'Confirmation unavailable'; end if;
 select * into v from public.visits where invitation_id=i.id;
 if v.id is null then raise exception 'Confirmation unavailable'; end if;
 select name into site_name from public.sites where id=i.site_id;
 return jsonb_build_object('reference',v.id,'status',v.status,'registered_at',v.created_at,'site_name',site_name,'expires_at',least(i.expires_at,i.redeemed_at+interval '1 hour'));
end$$;
revoke all on function public.get_visitor_confirmation(text) from public,anon,authenticated;
grant execute on function public.get_visitor_confirmation(text) to anon,authenticated;

-- Remove expired challenge metadata without retaining bearer material indefinitely.
alter function private.retain() rename to retain_domain_records;
create function private.retain() returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.retain_domain_records();
 delete from private.site_checkin_flows f using private.site_checkin_links q where f.link_id=q.id and q.expires_at<now()-interval '30 days';
 delete from private.site_checkin_links where expires_at<now()-interval '30 days';
 delete from private.platform_audit where created_at<now()-interval '90 days';
end$$;
revoke all on function private.retain() from public,anon,authenticated;

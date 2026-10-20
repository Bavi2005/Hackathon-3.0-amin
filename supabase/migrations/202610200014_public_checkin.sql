create table private.site_checkin_links(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null,site_id uuid not null,token_hash text not null unique,
 created_by uuid not null references auth.users,created_at timestamptz not null default now(),expires_at timestamptz not null,revoked_at timestamptz,
 foreign key(tenant_id,site_id) references public.sites(tenant_id,id)
);
create table private.site_checkin_flows(
 link_id uuid not null references private.site_checkin_links,request_id uuid not null,invitation_id uuid not null references public.invitations,
 created_at timestamptz not null default now(),primary key(link_id,request_id)
);
alter table private.site_checkin_links enable row level security;
alter table private.site_checkin_flows enable row level security;
revoke all on private.site_checkin_links,private.site_checkin_flows from public,anon,authenticated;
create function public.create_site_checkin_link(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; token text; ident uuid;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'visits.forms.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 if (select count(*) from private.site_checkin_links where site_id=s.id and created_at>now()-interval '1 hour')>=10 then raise exception 'Site QR issuance limit'; end if;
 update private.site_checkin_links set revoked_at=now() where site_id=s.id and revoked_at is null;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into private.site_checkin_links(tenant_id,site_id,token_hash,created_by,expires_at) values(s.tenant_id,s.id,encode(extensions.digest(token,'sha256'),'hex'),auth.uid(),now()+interval '24 hours') returning id into ident;
 perform private.audit(s.tenant_id,s.id,'visitor.site-qr.created',ident);
 return jsonb_build_object('id',ident,'token',token,'expires_at',now()+interval '24 hours');
end$$;
revoke all on function public.create_site_checkin_link(uuid) from public,anon,authenticated;
grant execute on function public.create_site_checkin_link(uuid) to authenticated;
create function public.revoke_site_checkin_link(p_site uuid,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare s public.sites;
begin
 select * into s from public.sites where id=p_site for update;
 if not private.allowed(s.tenant_id,s.id,'visits.forms.manage') then raise exception 'Forbidden' using errcode='42501'; end if;
 update private.site_checkin_links set revoked_at=coalesce(revoked_at,now()) where id=p_id and site_id=s.id;
 perform private.audit(s.tenant_id,s.id,'visitor.site-qr.revoked',p_id);
end$$;
revoke all on function public.revoke_site_checkin_link(uuid,uuid) from public,anon,authenticated;
grant execute on function public.revoke_site_checkin_link(uuid,uuid) to authenticated;
create function public.begin_site_checkin(p_token text,p_request uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare q private.site_checkin_links; s public.sites; i public.invitations; flow_token text;
begin
 if p_token is null or p_token!~'^[a-f0-9]{64}$' or p_request is null then raise exception 'Site check-in unavailable'; end if;
 select * into q from private.site_checkin_links where token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 perform 1 from public.sites where id=q.site_id for share;
 select * into q from private.site_checkin_links where token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if q.id is null or q.expires_at<=now() or q.revoked_at is not null or not exists(select 1 from public.memberships where user_id=q.created_by and site_id=q.site_id and active and 'visits.forms.manage'=any(capabilities)) then raise exception 'Site check-in unavailable'; end if;
 flow_token:=encode(extensions.hmac(convert_to(q.id::text||':'||p_request::text,'UTF8'),(select otp_key from private.runtime_settings),'sha256'),'hex');
 select inv.* into i from private.site_checkin_flows f join public.invitations inv on inv.id=f.invitation_id where f.link_id=q.id and f.request_id=p_request;
 if found then
   if i.redeemed_at is not null or i.expires_at<=now() then raise exception 'Registration flow already used or expired'; end if;
   return jsonb_build_object('token',flow_token,'expires_at',i.expires_at);
 end if;
 if (select count(*) from private.site_checkin_flows where link_id=q.id and created_at>now()-interval '10 minutes')>=100 then raise exception 'Site check-in busy; ask the guard for assistance'; end if;
 select * into s from public.sites where id=q.site_id for share;
 insert into public.invitations(tenant_id,site_id,owner_id,token_hash,expires_at,form_version_id)
 values(q.tenant_id,q.site_id,q.created_by,encode(extensions.digest(flow_token,'sha256'),'hex'),least(q.expires_at,now()+interval '30 minutes'),s.visitor_form_version_id) returning * into i;
 insert into private.site_checkin_flows(link_id,request_id,invitation_id) values(q.id,p_request,i.id);
 perform private.audit(q.tenant_id,q.site_id,'visitor.site-qr.flow.started',i.id);
 return jsonb_build_object('token',flow_token,'expires_at',i.expires_at);
end$$;
revoke all on function public.begin_site_checkin(text,uuid) from public,anon,authenticated;
grant execute on function public.begin_site_checkin(text,uuid) to anon,authenticated;

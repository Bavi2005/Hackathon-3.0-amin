-- Human-reviewed visitor record access/correction/minimization; not legal certification.
create table private.visitor_privacy_requests(
 id uuid primary key,tenant_id uuid not null,site_id uuid not null,visit_id uuid not null,
 requester uuid not null references auth.users,kind text not null check(kind in ('access','correction','erasure')),
 proposed_name text check(length(btrim(proposed_name)) between 1 and 80),
 status text not null default 'requested' check(status in ('requested','approved','rejected','completed')),
 reviewer uuid references auth.users,decision_reason text,created_at timestamptz not null default now(),reviewed_at timestamptz,completed_at timestamptz,
 foreign key(tenant_id,site_id,visit_id) references public.visits(tenant_id,site_id,id),
 check((kind='correction')=(proposed_name is not null))
);
create table private.visitor_legal_holds(
 visit_id uuid primary key,tenant_id uuid not null,site_id uuid not null,reason text not null check(reason in ('incident_review','legal_obligation','dispute')),
 expires_at timestamptz not null,actor uuid not null references auth.users,created_at timestamptz not null default now(),
 foreign key(tenant_id,site_id,visit_id) references public.visits(tenant_id,site_id,id)
);
alter table private.visitor_privacy_requests enable row level security;
alter table private.visitor_legal_holds enable row level security;
revoke all on private.visitor_privacy_requests,private.visitor_legal_holds from public,anon,authenticated;
create function public.request_visit_privacy(p_id uuid,p_visit uuid,p_kind text,p_name text default null) returns uuid language plpgsql security definer set search_path='' as $$
declare v public.visits; r private.visitor_privacy_requests;
begin
 select * into v from public.visits where id=p_visit;
 if not private.allowed(v.tenant_id,v.site_id) or not(v.owner_id=auth.uid() or private.allowed(v.tenant_id,v.site_id,'privacy.review')) then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id is null or p_kind is null or p_kind not in ('access','correction','erasure') or (p_kind='correction' and (p_name is null or length(btrim(p_name)) not between 1 and 80)) or (p_kind<>'correction' and p_name is not null) then raise exception 'Invalid privacy request' using errcode='22023'; end if;
 perform 1 from public.memberships where user_id=auth.uid() and site_id=v.site_id for update;
 select * into r from private.visitor_privacy_requests where id=p_id;
 if found then
   if r.requester<>auth.uid() or r.visit_id<>v.id or r.kind<>p_kind or r.proposed_name is distinct from p_name then raise exception 'Privacy request conflict' using errcode='22023'; end if;
   return r.id;
 end if;
 if (select count(*) from private.visitor_privacy_requests where requester=auth.uid() and created_at>now()-interval '1 hour')>=10 then raise exception 'Privacy request rate limit'; end if;
 insert into private.visitor_privacy_requests(id,tenant_id,site_id,visit_id,requester,kind,proposed_name) values(p_id,v.tenant_id,v.site_id,v.id,auth.uid(),p_kind,p_name);
 perform private.audit(v.tenant_id,v.site_id,'privacy.requested.'||p_kind,v.id);return p_id;
end$$;
revoke all on function public.request_visit_privacy(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.request_visit_privacy(uuid,uuid,text,text) to authenticated;
create function public.list_privacy_requests(p_site uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.sites; result jsonb;
begin
 select * into s from public.sites where id=p_site;
 if not private.allowed(s.tenant_id,s.id) then raise exception 'Forbidden' using errcode='42501'; end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc),'[]'::jsonb) into result from
 (select r.id,r.visit_id,r.requester,r.kind,r.proposed_name,r.status,r.decision_reason,r.created_at,r.reviewed_at,r.completed_at,h.expires_at as hold_until,h.reason as hold_reason
 from private.visitor_privacy_requests r left join private.visitor_legal_holds h on h.visit_id=r.visit_id and h.expires_at>now()
 where r.site_id=s.id and (r.requester=auth.uid() or private.allowed(s.tenant_id,s.id,'privacy.review')) order by r.created_at desc limit 100) r;
 perform private.audit(s.tenant_id,s.id,'privacy.requests.read',s.id); return result;
end$$;
revoke all on function public.list_privacy_requests(uuid) from public,anon,authenticated;
grant execute on function public.list_privacy_requests(uuid) to authenticated;
create function public.review_privacy_request(p_id uuid,p_approve boolean,p_reason text,p_identity_checked boolean) returns void language plpgsql security definer set search_path='' as $$
declare r private.visitor_privacy_requests;
begin
 select * into r from private.visitor_privacy_requests where id=p_id for update;
 if not private.allowed(r.tenant_id,r.site_id,'privacy.review') or r.requester=auth.uid() then raise exception 'Independent authorized reviewer required' using errcode='42501'; end if;
 perform private.require_step_up(r.tenant_id);
 if p_approve is null or p_identity_checked is distinct from true or p_reason is null or p_reason not in ('verified_authority','insufficient_authority','retention_obligation')
 or (p_approve and p_reason<>'verified_authority') then raise exception 'Verified identity, authority and decision reason required' using errcode='22023'; end if;
 if r.status<>'requested' then raise exception 'Request already reviewed' using errcode='22023'; end if;
 update private.visitor_privacy_requests set status=case when p_approve then 'approved' else 'rejected' end,reviewer=auth.uid(),decision_reason=p_reason,reviewed_at=now() where id=r.id;
 perform private.audit(r.tenant_id,r.site_id,'privacy.reviewed.'||case when p_approve then 'approved' else 'rejected' end,r.visit_id);
end$$;
revoke all on function public.review_privacy_request(uuid,boolean,text,boolean) from public,anon,authenticated;
grant execute on function public.review_privacy_request(uuid,boolean,text,boolean) to authenticated;
create function public.set_visitor_hold(p_visit uuid,p_days int,p_reason text,p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 select * into v from public.visits where id=p_visit for update;
 if not private.allowed(v.tenant_id,v.site_id,'privacy.hold') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(v.tenant_id);
 if p_confirm is distinct from true or p_days is null or p_days not between 0 and 365 or p_reason is null or p_reason not in ('incident_review','legal_obligation','dispute') then raise exception 'Invalid hold decision' using errcode='22023'; end if;
 if p_days=0 then delete from private.visitor_legal_holds where visit_id=v.id;
 else
   insert into private.visitor_legal_holds(visit_id,tenant_id,site_id,reason,expires_at,actor) values(v.id,v.tenant_id,v.site_id,p_reason,now()+make_interval(days=>p_days),auth.uid())
   on conflict(visit_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,actor=excluded.actor,created_at=now();
 end if;
 insert into public.audit_events(tenant_id,site_id,actor,action,record_id,metadata) values(v.tenant_id,v.site_id,auth.uid(),'privacy.hold.'||case when p_days=0 then 'released' else 'set' end,v.id,jsonb_build_object('reason',p_reason,'days',p_days));
end$$;
revoke all on function public.set_visitor_hold(uuid,int,text,boolean) from public,anon,authenticated;
grant execute on function public.set_visitor_hold(uuid,int,text,boolean) to authenticated;
create function public.fulfill_privacy_request(p_id uuid,p_confirm boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.visitor_privacy_requests; v public.visits; result jsonb;
begin
 select * into r from private.visitor_privacy_requests where id=p_id;
 if not private.allowed(r.tenant_id,r.site_id,'privacy.review') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform private.require_step_up(r.tenant_id);
 select * into v from public.visits where id=r.visit_id for update;
 select * into r from private.visitor_privacy_requests where id=p_id for update;
 if p_confirm is distinct from true or r.status not in ('approved','completed') then raise exception 'Approved request and explicit confirmation required' using errcode='22023'; end if;
 if r.kind<>'access' and r.status='completed' then return jsonb_build_object('status','completed','kind',r.kind,'visit_id',r.visit_id); end if;
 if r.kind<>'access' and (v.status='onsite' or exists(select 1 from private.visitor_legal_holds where visit_id=v.id and expires_at>now())) then
   raise exception 'Record is on site or under active hold; changes blocked' using errcode='22023'; end if;
 if r.kind='access' then
   result:=jsonb_build_object('visit_id',v.id,'guest_name',v.guest_name,'status',v.status,'created_at',v.created_at,'entered_at',v.entered_at,'exited_at',v.exited_at,
     'form',(select private.visitor_form_json(form_version_id) from public.visitor_form_responses where visit_id=v.id),
     'answers',(select answers from public.visitor_form_responses where visit_id=v.id));
 elsif r.kind='correction' then
   if v.guest_name in ('[retained anonymously]','[erased on request]') then raise exception 'Anonymized record cannot be reidentified' using errcode='22023'; end if;
   update public.visits set guest_name=btrim(r.proposed_name) where id=v.id;
   result:=jsonb_build_object('status','completed','kind','correction','visit_id',v.id);
 else
   update public.visits set guest_name='[erased on request]' where id=v.id;
   update public.visitor_form_responses set answers='{}'::jsonb,anonymized_at=now() where visit_id=v.id;
   update private.visitor_privacy_requests set proposed_name='[erased on request]' where visit_id=v.id and proposed_name is not null;
   result:=jsonb_build_object('status','completed','kind','erasure','visit_id',v.id,'retained','Minimal visit reference, host association and operational timestamps remain under retention policy');
 end if;
 update private.visitor_privacy_requests set status='completed',completed_at=coalesce(completed_at,now()),proposed_name=case when kind='correction' then proposed_name else null end where id=r.id;
 perform private.audit(r.tenant_id,r.site_id,'privacy.fulfilled.'||r.kind,r.visit_id);return result;
end$$;
revoke all on function public.fulfill_privacy_request(uuid,boolean) from public,anon,authenticated;
grant execute on function public.fulfill_privacy_request(uuid,boolean) to authenticated;

-- Hold and cleanup acquire the same visit lock, so a concurrent hold cannot be ignored.
create or replace function private.retain() returns void language plpgsql security definer set search_path='' as $$
declare v public.visits;
begin
 delete from public.gps_observations where observed_at<now()-interval '24 hours';
 update public.vehicles set lat=null,lng=null,accuracy=null,observed_at=null where observed_at<now()-interval '24 hours';
 delete from public.iot_events where created_at<now()-interval '7 days';
 for v in select * from public.visits where created_at<now()-interval '30 days' order by id for update loop
   if exists(select 1 from private.visitor_legal_holds where visit_id=v.id and expires_at>now()) then continue; end if;
   update public.visits set guest_name='[retained anonymously]' where id=v.id and guest_name not in ('[retained anonymously]','[erased on request]');
   update public.visitor_form_responses set answers='{}'::jsonb,anonymized_at=now() where visit_id=v.id and anonymized_at is null;
   update private.visitor_privacy_requests set proposed_name='[retained anonymously]' where visit_id=v.id and proposed_name is not null;
 end loop;
 delete from public.audit_events e where created_at<now()-interval '90 days' and not exists(select 1 from private.visitor_legal_holds h where h.visit_id=e.record_id and h.expires_at>now());
 delete from private.visitor_otp_challenges c using public.invitations i where c.invitation_id=i.id and i.expires_at<now()-interval '1 day';
 delete from private.assisted_registrations where created_at<now()-interval '30 days';
 delete from private.staff_invitations where expires_at<now()-interval '30 days';
 delete from private.parking_overrides where expires_at<now()-interval '1 day';
 delete from private.dispatch_decisions where created_at<now()-interval '90 days';
end$$;

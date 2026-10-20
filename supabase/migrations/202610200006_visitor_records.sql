-- Additive visitor records slice. Existing membership grants are never widened.
alter table public.audit_events add column metadata jsonb not null default '{}'::jsonb
  check(jsonb_typeof(metadata)='object');
create index audit_export_rate on public.audit_events(actor,site_id,created_at)
  where action='visitors.exported';

-- This helper is not exposed to API roles. Both public RPCs authorize before calling it.
create function private.visitor_records(p_site uuid,p_from timestamptz,p_until timestamptz,
  p_status text,p_query text,p_limit int,p_offset int) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_from is null or p_until is null or not isfinite(p_from) or not isfinite(p_until)
   or p_until<=p_from or p_until-p_from>interval '31 days'
   or p_status is null or p_status not in ('all','pending_entry','onsite','departed')
   or p_query is null or length(p_query)>80
   or p_limit is null or p_limit not between 1 and 1001
   or p_offset is null or p_offset not between 0 and 10000 then
   raise exception 'Invalid visitor filters' using errcode='22023';
 end if;
 select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc,r.id desc),'[]'::jsonb) into result
 from (
   select v.id,
     case when v.guest_name='[retained anonymously]' then v.guest_name
       else left(v.guest_name,1)||'***' end as masked_name,
     v.status,v.created_at,v.entered_at,v.exited_at
   from public.visits v join public.sites s on s.id=v.site_id and s.tenant_id=v.tenant_id
   where v.site_id=p_site and v.created_at>=p_from and v.created_at<p_until
     and (p_status='all' or v.status=p_status)
     -- Literal substring, never a LIKE pattern, interpolated SQL, or query language.
     and (btrim(p_query)='' or strpos(lower(v.guest_name),lower(btrim(p_query)))>0
       or strpos(v.id::text,lower(btrim(p_query)))>0)
   order by v.created_at desc,v.id desc limit p_limit offset p_offset
 ) r;
 return result;
end$$;
revoke all on function private.visitor_records(uuid,timestamptz,timestamptz,text,text,int,int) from public,anon,authenticated;

create function public.search_visitor_records(p_site uuid,p_from timestamptz,p_until timestamptz,
  p_status text default 'all',p_query text default '',p_limit int default 25,p_offset int default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid; records jsonb; more boolean;
begin
 select tenant_id into t from public.sites where id=p_site;
 if not private.allowed(t,p_site,'visits.read.site') then
   raise exception 'Forbidden' using errcode='42501';
 end if;
 if p_limit is null or p_limit not between 1 and 100 then
   raise exception 'Invalid visitor filters' using errcode='22023';
 end if;
 records:=private.visitor_records(p_site,p_from,p_until,p_status,p_query,p_limit+1,p_offset);
 more:=jsonb_array_length(records)>p_limit;
 if more then records:=records-p_limit; end if;
 -- Search terms may contain PII: never store them in the audit trail.
 insert into public.audit_events(tenant_id,site_id,actor,action,metadata)
 values(t,p_site,auth.uid(),'visitors.searched',jsonb_build_object(
   'from',p_from,'until',p_until,'status',p_status,'count',jsonb_array_length(records)));
 return jsonb_build_object('records',records,'has_more',more,'offset',p_offset);
end$$;
revoke all on function public.search_visitor_records(uuid,timestamptz,timestamptz,text,text,int,int) from public,anon,authenticated;
grant execute on function public.search_visitor_records(uuid,timestamptz,timestamptz,text,text,int,int) to authenticated;

create function public.export_visitor_records(p_site uuid,p_from timestamptz,p_until timestamptz,
  p_reason text,p_status text default 'all',p_query text default '')
returns jsonb language plpgsql security definer set search_path='' as $$
declare t uuid; records jsonb;
begin
 select tenant_id into t from public.sites where id=p_site;
 if not private.allowed(t,p_site,'visits.read.site') or not private.allowed(t,p_site,'exports.visits') then
   raise exception 'Forbidden' using errcode='42501';
 end if;
 if p_reason is null or p_reason not in ('operations_review','incident_review','privacy_request') then
   raise exception 'Choose an export purpose' using errcode='22023';
 end if;
 -- Serialize same-account/site exports so concurrent requests cannot bypass the limit.
 perform 1 from public.memberships where user_id=auth.uid() and site_id=p_site for update;
 if (select count(*) from public.audit_events where actor=auth.uid() and site_id=p_site
   and action='visitors.exported' and created_at>now()-interval '1 hour')>=10 then
   raise exception 'Export rate limit' using errcode='P0001';
 end if;
 records:=private.visitor_records(p_site,p_from,p_until,p_status,p_query,1001,0);
 if jsonb_array_length(records)>1000 then
   raise exception 'Too many records; narrow the filters' using errcode='22023';
 end if;
 -- Transaction commits this audit before PostgREST returns any export data.
 insert into public.audit_events(tenant_id,site_id,actor,action,metadata)
 values(t,p_site,auth.uid(),'visitors.exported',jsonb_build_object(
   'reason',p_reason,'from',p_from,'until',p_until,'status',p_status,'count',jsonb_array_length(records)));
 return jsonb_build_object('records',records,'count',jsonb_array_length(records),'generated_at',now());
end$$;
revoke all on function public.export_visitor_records(uuid,timestamptz,timestamptz,text,text) from public,anon,authenticated;
grant execute on function public.export_visitor_records(uuid,timestamptz,timestamptz,text,text) to authenticated;

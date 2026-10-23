import {useCallback, useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Overview = {tenants: {id: string; name: string; demo: boolean; sites: number; active_memberships: number}[]; simulation_enabled: boolean; integrations: Record<string, string>; audit: {action: string; record_id: string; created_at: string}[]};
type Activity = {visitors:number;onsite:number;visitors_today?:number;rides:number;ride_requests:number;shuttles:number;routes:number;parking_zones:number;parking_capacity:number;fresh_parking_zones:number;known_free_parking?:number;parking_facilities?:number;loading_total?:number;loading_active?:number;loading_completed?:number;locations?:{site_id:string;site_name:string;township_name:string;visitors:number;loading_total:number;loading_active:number;facilities:number}[];activity:{action:string;created_at:string}[]};
export function PlatformAdministration({db}: {db: SupabaseClient}) {
  const [pulse, setPulse] = useState<Activity | null>(null);
  const [data, setData] = useState<Overview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lifetime = useRef(new AbortController()), request = useRef(crypto.randomUUID());
  const load = useCallback(async() => {const signal=AbortSignal.any([lifetime.current.signal,AbortSignal.timeout(15000)]);const [overview,activity]=await Promise.all([db.rpc('get_platform_overview').abortSignal(signal),db.rpc('get_platform_activity').abortSignal(signal)]);if(lifetime.current.signal.aborted)return;if(overview.error)throw Error(overview.error.message);setData(overview.data);if(activity.error){setPulse(null);}else setPulse(activity.data as Activity);}, [db]);
  useEffect(() => {const controller = new AbortController(); lifetime.current = controller; void load().catch(e => {if (!controller.signal.aborted) setError(e.message);}); return () => controller.abort();}, [load]);
  async function create(form: FormData) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const {error} = await db.rpc('create_platform_tenant', {p_id: request.current, p_name: form.get('name'), p_site_name: form.get('site'), p_admin: form.get('admin')}).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
      if (lifetime.current.signal.aborted) return; if (error) throw Error(error.message); setMessage('Tenant, initial site and explicit administrator assignment recorded.'); await load();
    } catch (failure) {if (!lifetime.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Tenant setup unavailable');}
    finally {if (!lifetime.current.signal.aborted) setBusy(false);}
  }
  function exportSummary(){if(!pulse||!data)return;const escaped=(value:unknown)=>{let cell=String(value??'');if(/^[\s]*[=+@-]/.test(cell))cell="'"+cell;return '"'+cell.replaceAll('"','""')+'"';};const records=(pulse.locations??[]).map(x=>[x.township_name,x.site_name,x.visitors,x.loading_total,x.loading_active,x.facilities]);const csv=['Township,Site,Visitor registrations,Loading sessions,Currently loading,Parking facilities',...records.map(row=>row.map(escaped).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob(['\uFEFF',csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='township-operations-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage('Aggregate operations CSV downloaded. No private visitor identities or vehicle references included.');}
  return <section aria-label="Platform administration"><p>This separately granted platform view contains tenant configuration and counts. It gives no default access to private visitor records or GPS. Do not enter real organization or account information in this prototype.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>Refresh platform</button>
    {data && <><div className="platform-welcome"><span className="eyebrow">SMARTTOWNSHIP / CONTROL CENTRE</span><h2>One community. Every service. One clear view.</h2><p>Fictional, permission-checked operations across the demo townships. Figures come from actual stored application records—not painted-on statistics.</p><span className="platform-demo-chip">● SIMULATED OPERATIONS · {data.simulation_enabled?'DEVELOPMENT ENABLED':'SIMULATOR DISABLED'}</span></div>
    {pulse && <><div className="platform-signal-grid">
      <article><span className="eyebrow">REGISTERED ARRIVALS</span><strong>{pulse.visitors}</strong><p>{pulse.onsite} guests on site</p><span className="platform-signal-icon">↗</span></article>
      <article><span className="eyebrow">SHUTTLE JOURNEYS</span><strong>{pulse.rides}</strong><p>{pulse.ride_requests} awaiting dispatch</p><span className="platform-signal-icon">➜</span></article>
      <article><span className="eyebrow">COMMUNITY FLEET</span><strong>{pulse.shuttles}</strong><p>{pulse.routes} published routes</p><span className="platform-signal-icon">◇</span></article>
      <article><span className="eyebrow">PARKING NETWORK</span><strong>{pulse.parking_zones}</strong><p>{pulse.fresh_parking_zones} counter zones reporting recently</p><span className="platform-signal-icon">P</span></article>
    </div>
    <section className="platform-feed"><div><span className="eyebrow">OPERATIONAL MOMENTUM</span><h3>Recent system activity</h3><p>Recent audited actions only. No private visitor names or driver coordinates.</p></div><div>{pulse.activity.length?pulse.activity.map((event,i)=><div className="platform-feed-row" key={i}><span className="feed-dot"/><span>{event.action.replaceAll('.',' · ')}</span><small>{new Date(event.created_at).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small></div>):<p>No recent auditable actions. New administrative changes appear here.</p>}</div></section></>}
    {pulse&&<><div className="platform-signal-grid platform-extra-stats" aria-label="Venue arrival and loading metrics">
      <article><span className="eyebrow">VISITORS TODAY</span><strong>{pulse.visitors_today??0}</strong><p>Malaysia local time, demo registrations</p><span className="platform-signal-icon">↗</span></article>
      <article><span className="eyebrow">LOADING VEHICLES ACTIVE</span><strong>{pulse.loading_active??0}</strong><p>{pulse.loading_total??0} logged loading arrivals</p><span className="platform-signal-icon">↓</span></article>
      <article><span className="eyebrow">GOODS DEPARTURES</span><strong>{pulse.loading_completed??0}</strong><p>Server-verified departures</p><span className="platform-signal-icon">✓</span></article>
      <article><span className="eyebrow">PARKING NOW</span><strong>{pulse.known_free_parking??0}</strong><p>Known free · {pulse.fresh_parking_zones} fresh counter zones · {pulse.parking_facilities??0} facilities</p><span className="platform-signal-icon">P</span></article>
    </div><section className="platform-export-summary"><div><span className="eyebrow">SITE-BY-SITE INTELLIGENCE</span><h3>Download an operations report.</h3><p>Aggregate per-site arrivals and loading counts. CSV excludes names, number plates and sensitive form answers.</p></div><button className="secondary" onClick={exportSummary}>Download statistics CSV ↓</button></section></>}
    <div className="cards" aria-label="Platform pulse">
      <article><span className="eyebrow">TOWNSHIPS</span><strong className="count">{data.tenants.length}</strong><p>Organizations in the platform</p></article>
      <article><span className="eyebrow">MANAGED SITES</span><strong className="count">{data.tenants.reduce((n,t)=>n+t.sites,0)}</strong><p>Configured community locations</p></article>
      <article><span className="eyebrow">ACTIVE MEMBERSHIPS</span><strong className="count">{data.tenants.reduce((n,t)=>n+t.active_memberships,0)}</strong><p>Accounts assigned to sites</p></article>
      <article><span className="eyebrow">SIMULATOR</span><strong className="count">{data.simulation_enabled?'On':'Off'}</strong><p>Development-only fictional activity</p></article>
    </div>
    <h2>Township portfolio</h2><p>Aggregate figures only. Private resident, visitor and GPS records remain protected.</p>
    <div className="cards">{data.tenants.map(t=><article key={t.id}><span className="badge">{t.demo?'FICTIONAL DEMO':'TENANT'}</span><h2>{t.name}</h2><p><strong>{t.sites}</strong> sites · <strong>{t.active_memberships}</strong> active memberships</p><small>Reference: {t.id.slice(0,8)}</small></article>)}</div>
    <h2>Integration status</h2><div className="cards">{Object.entries(data.integrations).map(([name,status])=><article key={name}><span className="eyebrow">{name.toUpperCase()}</span><h3>{name==='sms'?'Visitor verification':name==='routing'?'Shuttle routing':'Parking sensors'}</h3><p>{status}</p></article>)}</div>
      <form onChange={() => {request.current = crypto.randomUUID();}} onSubmit={e => {e.preventDefault(); void create(new FormData(e.currentTarget));}}><fieldset disabled={busy}><legend>Create tenant</legend>
        <label>Tenant name<input name="name" required maxLength={100}/></label><label>Initial site name<input name="site" required maxLength={100}/></label><label>Initial administrator account reference<input name="admin" required pattern="[0-9a-fA-F-]{36}"/></label>
        <label className="check"><input type="checkbox" required/>I confirm the new tenant and this explicit administrator assignment.</label><button disabled={busy}>Create tenant and site</button>
      </fieldset></form><h3>Platform change audit</h3>{data.audit.map((a, index) => <p key={`${a.record_id}:${index}`}>{a.action} · {a.record_id} · {new Date(a.created_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}</p>)}</>}
  </section>;
}
export function TownshipSiteCreator({db, tenant}: {db: SupabaseClient; tenant: string}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const request = useRef(crypto.randomUUID()), pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  return <form aria-label="Township site creation" onChange={() => {request.current = crypto.randomUUID();}} onSubmit={async e => {
    e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget), controller = new AbortController(); pending.current = controller; setBusy(true); setMessage(''); setError('');
    try {const {error} = await db.rpc('create_township_site', {p_tenant: tenant, p_id: request.current, p_name: f.get('name')}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])); if (controller.signal.aborted) return; if (error) throw Error(error.message); setMessage('Site created with your authorized township administration grant. Reload the workspace to select it.');}
    catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Site setup unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }}><fieldset disabled={busy}><legend>Create township site</legend>{error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <label>New site name<input name="name" required maxLength={100}/></label><label className="check"><input type="checkbox" required/>I confirm this site belongs to my assigned township.</label><button disabled={busy}>Create township site</button>
  </fieldset></form>;
}

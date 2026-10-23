import {useCallback,useEffect,useRef,useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {Icon} from './Icon';

type Daily={date:string;visitors:number;loading:number;rides:number};
type Site={
 site_id:string;site_name:string;township_name:string;
 visitors:number;onsite:number;pending:number;loading_total:number;loading_active:number;
 facilities:number;counter_zones:number;zones_reporting:number;known_free:number;rides_waiting:number;staff_accounts:number;
};
type Facility={
 facility_id:string;facility_name:string;site_name:string;township_name:string;levels:number;
 zones:number;fresh_counters:number;counter_capacity:number;known_free:number;individually_free_bays:number;individually_tracked_bays:number;
};
type Pulse={
 visitors:number;onsite:number;visitors_today:number;pending_entry:number;rides:number;ride_requests:number;
 shuttles:number;routes:number;parking_zones:number;parking_capacity:number;fresh_parking_zones:number;
 known_free_parking:number;parking_facilities:number;loading_total:number;loading_active:number;loading_completed:number;
 locations:Site[];facilities:Facility[];daily_trends:Daily[];activity:{action:string;created_at:string}[];generated_at?:string;
};
type Overview={
 tenants:{id:string;name:string;demo:boolean;sites:number;active_memberships:number}[];
 simulation_enabled:boolean;integrations:Record<string,string>;
};
const fmt=(value:number)=>new Intl.NumberFormat('en-MY').format(Number.isFinite(value)?value:0);
const at=(value:string)=>new Date(value).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
const csvCell=(raw:unknown)=>{let v=String(raw??'');if(/^[\s]*[=+@-]/.test(v))v="'"+v;return '"'+v.replaceAll('"','""')+'"';};
export function OperatorDashboard({db,onNavigate}:{db:SupabaseClient;onNavigate:(tab:string)=>void}){
 const [overview,setOverview]=useState<Overview|null>(null),[pulse,setPulse]=useState<Pulse|null>(null);
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lifetime=useRef(new AbortController()),running=useRef(false);
 const load=useCallback(async(silent=false)=>{
  if(running.current)return;running.current=true;if(silent)setRefreshing(true);else setLoading(true);
  try{
   const signal=AbortSignal.any([lifetime.current.signal,AbortSignal.timeout(15000)]);
   const [p,o]=await Promise.all([db.rpc('get_platform_activity').abortSignal(signal),db.rpc('get_platform_overview').abortSignal(signal)]);
   if(lifetime.current.signal.aborted)return;
   if(p.error)throw Error('Operational statistics: '+p.error.message);
   if(o.error)throw Error('Platform permissions: '+o.error.message);
   const data=p.data as Pulse,summary=o.data as Overview;
   if(!data || !summary || !Array.isArray(data.locations) || !Array.isArray(data.facilities) || !Array.isArray(data.daily_trends)) throw Error('Operator dashboard requires the latest aggregation migration. Check that the demo database is up to date.');
   setPulse(data);setOverview(summary);setError('');
  }catch(e){if(!lifetime.current.signal.aborted)setError(e instanceof Error?e.message:'Could not load operator metrics');}
  finally{running.current=false;if(!lifetime.current.signal.aborted){setLoading(false);setRefreshing(false);}}
 },[db]);
 useEffect(()=>{const controller=new AbortController();lifetime.current=controller;void load();const timer=setInterval(()=>void load(true),30000);return()=>{controller.abort();clearInterval(timer);};},[load]);
 function download(){
  if(!pulse||!overview)return;
  const headers=['Township','Site','Visitors','On site','Pending entry','Loading sessions','Loading now','Parking facilities','Counter zones reporting','Counter zones total','Known free counter spaces','Rides waiting','Active memberships'];
  const rows=pulse.locations.map(s=>[s.township_name,s.site_name,s.visitors,s.onsite,s.pending,s.loading_total,s.loading_active,s.facilities,s.zones_reporting,s.counter_zones,s.known_free,s.rides_waiting,s.staff_accounts]);
  const content='\uFEFF'+[headers,...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='operator-township-overview-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  setNotice('Aggregate site report downloaded. Private visitor names and number plates are excluded.');
 }
 const days=pulse?.daily_trends??[],max=Math.max(1,...days.map(x=>x.visitors+x.loading));
 const siteCount=pulse?.locations.length??0;
 return <section className="operator-console" aria-label="Operator control centre">
  <div className="op-hero"><div className="op-hero-copy"><span className="op-label">SMARTTOWNSHIP <span>/</span> PLATFORM OPERATIONS</span><h2>Every township.<br/><em>One clear picture.</em></h2><p>Real counts from your fictional demo database. Visitor arrivals, mall loading, mobility and parking—without exposing private guest details.</p><div className="op-hero-actions"><button onClick={()=>onNavigate('Platform')}>Manage platform <Icon name="arrow"/></button><button className="op-outline" onClick={()=>void load(true)} disabled={refreshing}> <Icon name="refresh"/>{refreshing?'Refreshing…':'Refresh overview'}</button></div><small>● DEVELOPMENT DEMO · PARKING SIMULATED · NO LIVE HARDWARE</small></div><div className="op-hero-art" aria-hidden="true"><span className="op-hero-grid">+ + + +<br/>+ + + +<br/>+ + + +</span><span className="op-hero-circle">OPS<small>CONTROL</small></span></div></div>
  {error&&<div className="op-error" role="alert"><strong>Could not refresh the Operator dashboard.</strong><p>{error}</p><button onClick={()=>void load()}>Try again</button></div>}
  {notice&&<p className="success" role="status">{notice}</p>}
  {loading&&!pulse&&<p role="status" className="op-loading">Loading cross-township operations…</p>}
  {pulse&&overview&&<><div className="op-heading"><div><span className="op-kicker">LIVE DATABASE SNAPSHOT</span><h3>Your network at a glance</h3><p>Last checked {pulse.generated_at?at(pulse.generated_at):'recently'} · Refreshes every 30 seconds</p></div><span className="op-online"><i/> Database reporting</span></div>
   <div className="op-metrics">
    {[
     {label:'VISITOR ARRIVALS TODAY',value:pulse.visitors_today,info:`${pulse.visitors} registered overall`,icon:'visitor' as const},
     {label:'GUESTS CURRENTLY ONSITE',value:pulse.onsite,info:`${pulse.pending_entry} awaiting entry`,icon:'check' as const},
     {label:'DELIVERIES LOADING NOW',value:pulse.loading_active,info:`${pulse.loading_total} vehicle sessions`,icon:'parking' as const},
     {label:'KNOWN FREE COUNTER SPACES',value:pulse.known_free_parking,info:`${pulse.fresh_parking_zones} fresh counter zones · estimated`,icon:'parking' as const},
     {label:'SHUTTLES REQUESTED',value:pulse.ride_requests,info:`${pulse.rides} journeys overall`,icon:'ride' as const},
     {label:'MONITORED LOCATIONS',value:siteCount,info:`${overview.tenants.length} townships · ${pulse.parking_facilities} parking facilities`,icon:'globe' as const},
    ].map(x=><article key={x.label} className="op-metric"><div className="op-metric-top"><span>{x.label}</span><span className="op-metric-icon"><Icon name={x.icon}/></span></div><strong>{fmt(x.value)}</strong><p>{x.info}</p></article>)}
   </div>
   <div className="op-main-grid">
    <section className="op-panel" aria-label="Seven-day arrivals trends"><header><div><span className="op-kicker">ACTIVITY IN MOTION</span><h3>Last 7 days</h3><p>New registrations and loading arrivals · Malaysia time</p></div><span className="op-small-chip">7 DAYS</span></header>
     <div className="op-chart" role="img" aria-label={'Daily visitor arrivals and loading sessions: '+days.map(d=>`${d.date}: ${d.visitors} visitors and ${d.loading} loading arrivals`).join('; ')}>{days.map(d=><div className="op-chart-day" key={d.date}><div className="op-chart-bars"><div className="op-bar visitor" title={`${d.visitors} visitors`} style={{height:`${d.visitors?Math.max(2,100*d.visitors/max):0}%`}}/><div className="op-bar loading" title={`${d.loading} loading arrivals`} style={{height:`${d.loading?Math.max(2,100*d.loading/max):0}%`}}/></div><strong>{d.visitors+d.loading}</strong><small>{new Date(d.date+'T00:00:00Z').toLocaleDateString('en-MY',{weekday:'short',timeZone:'UTC'})}</small></div>)}</div>
     <div className="op-chart-legend"><span><i className="op-key visitor"/> Visitors</span><span><i className="op-key loading"/> Loading arrivals</span><span className="op-muted">Counts from registration records</span></div>
    </section>
    <section className="op-panel op-action-panel" aria-label="Operations queue"><header><div><span className="op-kicker">THINGS THAT NEED ATTENTION</span><h3>Operations pulse</h3><p>Signals from recorded service statuses</p></div></header>
     <div className="op-alert-row"><span className="op-alert-icon">↗</span><div><strong>{pulse.pending_entry} visitors awaiting entry</strong><small>Pending security or guard verification</small></div></div>
     <div className="op-alert-row"><span className="op-alert-icon">▣</span><div><strong>{pulse.loading_active} active loading vehicles</strong><small>{pulse.loading_completed} checked out historically</small></div></div>
     <div className="op-alert-row"><span className="op-alert-icon">P</span><div><strong>{Math.max(0,pulse.locations.reduce((n,s)=>n+s.counter_zones,0)-pulse.fresh_parking_zones)} counter zones with expired or missing readings</strong><small>Only fresh counter observations are included in known-free figures</small></div></div>
     <div className="op-alert-row"><span className="op-alert-icon">➜</span><div><strong>{pulse.ride_requests} transport requests pending</strong><small>{pulse.shuttles} shuttle vehicles · {pulse.routes} routes published</small></div></div>
     <button className="op-text-action" onClick={()=>onNavigate('Platform')}>View platform administration <Icon name="arrow"/></button>
    </section>
   </div>
   <section className="op-panel op-locations" aria-label="Township site overview"><header><div><span className="op-kicker">MULTI-SITE VISIBILITY</span><h3>Townships & properties</h3><p>Site-by-site reporting, including locations with no activity</p></div><button className="op-export-btn" onClick={download}><Icon name="audit"/> Export operations CSV</button></header>
    <div className="op-location-list">{pulse.locations.map(s=><article key={s.site_id} className="op-location"><div className="op-location-title"><span className="op-location-symbol"><Icon name="globe"/></span><div><small>{s.township_name}</small><h4>{s.site_name}</h4></div><span className="op-location-status">{s.counter_zones>0?(s.zones_reporting>0?'REPORTING':'NO FRESH COUNT'):'NO COUNTERS'}</span></div><div className="op-location-numbers"><div><strong>{s.visitors}</strong><span>Visitors</span></div><div><strong>{s.onsite}</strong><span>Onsite</span></div><div><strong>{s.loading_active}</strong><span>Loading</span></div><div><strong>{s.counter_zones&&s.zones_reporting===0?'—':fmt(s.known_free)}</strong><span>Known free</span></div></div><div className="op-location-foot"><span>{s.facilities} parking facilities</span><span>{s.zones_reporting}/{s.counter_zones} counters current</span><span>{s.rides_waiting} rides waiting</span></div></article>)}</div>
    {!pulse.locations.length&&<div className="op-empty">No demonstration sites are configured yet. Set up a fictional tenant in Platform Management.</div>}
   </section>
   <section className="op-panel op-facilities" aria-label="Mall and parking facility overview"><header><div><span className="op-kicker">MALL & PARKING INTELLIGENCE</span><h3>Parking facilities</h3><p>Facility-level counters and individually monitored bay coverage</p></div><span className="op-small-chip">{pulse.facilities.length} FACILITIES</span></header>
    <div className="op-facility-grid">{pulse.facilities.map(f=><article key={f.facility_id} className="op-facility"><div className="op-facility-top"><div className="op-facility-symbol">P</div><span>{f.levels} levels</span></div><h4>{f.facility_name}</h4><p>{f.township_name} · {f.site_name}</p><div className="op-facility-numbers"><strong>{f.fresh_counters?fmt(f.known_free):'—'}</strong><span>{f.fresh_counters?'known free from counters':'No fresh counter readings'}</span></div><div className="op-facility-foot"><span>{f.fresh_counters} current counters</span><span>{f.individually_free_bays}/{f.individually_tracked_bays} known free sensor bays</span></div></article>)}</div>
    {!pulse.facilities.length&&<p className="op-empty">No facilities configured. New malls are created within authorized site administration.</p>}
    <p className="op-fineprint">All readings in this test project are fictional or simulated. Unknown and expired sensors are never counted as available. Counter totals and individual sensor bays are shown separately and should not be added together.</p>
   </section>
   <div className="op-bottom-grid"><section className="op-panel" aria-label="Integration readiness"><header><div><span className="op-kicker">SYSTEM CONNECTIVITY</span><h3>Integration readiness</h3><p>Actual configuration status, not simulated uptime</p></div></header><div className="op-integration-list">{Object.entries(overview.integrations).map(([name,status])=><div key={name} className="op-integration"><span className="op-integration-symbol"><Icon name={name==='iot'?'parking':name==='sms'?'visitor':'ride'}/></span><div><strong>{name==='sms'?'Phone verification':name==='routing'?'Transport routing':name==='iot'?'Parking & IoT adapter':name}</strong><small>{status}</small></div><span className="op-integration-mark">DEMO</span></div>)}</div><div className="op-privacy-foot"><Icon name="shield"/> Platform reports exclude visitor names, phone numbers, form answers and driver locations.</div></section>
   <section className="op-panel" aria-label="Recent audited events"><header><div><span className="op-kicker">AUDIT TRAIL</span><h3>Recent operations</h3><p>Latest recorded events, without personal details</p></div></header><div className="op-activity-list">{pulse.activity.map((a,i)=><div className="op-activity" key={a.created_at+':'+i}><span className="op-activity-dot"/><div><strong>{a.action.replaceAll('.',' › ').replaceAll('_',' ')}</strong><small>{at(a.created_at)}</small></div></div>)}{!pulse.activity.length&&<p className="op-empty">No audited activity yet.</p>}</div></section></div>
   <div className="op-footer-cta"><div><span className="op-kicker">PLATFORM ADMINISTRATION</span><h3>Need to manage tenant configuration?</h3><p>Create fictional townships, review integrations and manage platform-level records.</p></div><button onClick={()=>onNavigate('Platform')}>Open management <Icon name="arrow"/></button></div>
  </>}
 </section>;
}
export function OperatorAccessNotice({reason}:{reason?:string}){
 return <section aria-label="Operator access status" className="op-access"><span className="op-kicker">PLATFORM ROLE / ACCESS CONTROL</span><h2>Operator dashboard access not enabled.</h2><p>Your account has the Operator role, but this role alone does not grant access to other townships' data. A separate explicit platform grant is required.</p>{reason&&<p role="alert">The grant lookup could not finish: {reason}</p>}<div className="op-access-steps"><span>01</span><p>Use the primary test Operator account provisioned for the demo, or have a trusted platform administrator approve this account's explicit grant.</p></div><div className="op-access-steps"><span>02</span><p>Refresh the page after access has been provisioned. Private visitor records remain protected regardless of role.</p></div><p className="op-fineprint">This screen deliberately does not show fake statistics or bypass platform-level permission checks.</p></section>;
}

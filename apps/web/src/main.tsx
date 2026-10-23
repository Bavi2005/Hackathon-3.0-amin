import {Component,useCallback,useEffect,useRef,useState,type FormEvent,type ReactNode} from 'react';
import {createRoot} from 'react-dom/client';
import {createClient,type SupabaseClient,type Session} from '@supabase/supabase-js';
import {tabAuthOptions} from './tab-auth';
import QRCode from 'qrcode';
import {VisitorRecords} from './VisitorRecords';
import {GuestRegistration} from './GuestRegistration';
import {VisitorFormManager} from './VisitorFormManager';
import {VisitFormAnswers} from './VisitFormAnswers';
import {GuardAssistance} from './GuardAssistance';
import {SiteAdministration} from './SiteAdministration';
import {ParkingPanel} from './ParkingPanel';
import {LoadingDock} from './LoadingDock';
import {DispatchOptions} from './DispatchOptions';
import {TransportRoutes} from './TransportRoutes';
import {AccountSecurity} from './AccountSecurity';
import {PrivacyRequests} from './PrivacyRequests';
import {SiteAnalytics} from './SiteAnalytics';
import {PublicCheckin,SiteCheckinIssuer} from './SiteCheckin';
import {PlatformAdministration,TownshipSiteCreator} from './PlatformAdministration';
import {OperatorDashboard,OperatorAccessNotice} from './OperatorDashboard';
import {StaffAcceptance} from './StaffAcceptance';
import {freshness} from '../../../packages/contracts';
import {AppShell} from './AppShell';
import {HomeDashboard} from './HomeDashboard';
import {MobilityNetwork,type Route as MobilityRoute} from './MobilityNetwork';
import {Welcome} from './Welcome';
import {Icon} from './Icon';
import './style.css';

const url=import.meta.env.VITE_SUPABASE_URL,key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function connect():SupabaseClient|null{if(!url||!key)return null;try{return createClient(url,key,{auth:tabAuthOptions(url)});}catch{return null;}}
const db=connect();
type Row=Record<string,string|number|boolean|null>;
type Membership={id:string;tenant_id:string;site_id:string;role:string;capabilities:string[]};
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<main><h1>Something went wrong</h1><p>Your saved data remains in Supabase.</p><button onClick={()=>location.reload()}>Reload application</button></main>:this.props.children;}}
function App(){
 const [session,setSession]=useState<Session|null>(null),[ready,setReady]=useState(false),[members,setMembers]=useState<Membership[]>([]),[site,setSite]=useState(''),[tab,setTab]=useState('Overview'),[data,setData]=useState<Record<string,Row[]>>({}),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[connection,setConnection]=useState('Connecting'),[now,setNow]=useState(Date.now()),[invite,setInvite]=useState(''),[qr,setQr]=useState(''),[sharing,setSharing]=useState(false);
 const watch=useRef<number|null>(null),last=useRef(0);
 const [platform,setPlatform]=useState(false),[platformReady,setPlatformReady]=useState(false),[platformError,setPlatformError]=useState('');
 const sharingVehicle=useRef<string|null>(null);

 const [hash,setHash]=useState(location.hash);
 const userId=useRef<string|null>(null);
 const context=useRef('');context.current=`${session?.user.id??''}:${site}`;
 const token=new URLSearchParams(hash.slice(1)).get('invite');
 const staffToken=new URLSearchParams(hash.slice(1)).get('staff');
 const checkinToken=new URLSearchParams(hash.slice(1)).get('checkin');
 const arrivalIntent=new URLSearchParams(hash.slice(1)).get('intent')==='loading'?'loading':'visitor';
 const m=members.find(x=>x.site_id===site);const can=(c:string)=>m?.capabilities.includes(c)??false;
 const stop=useCallback(()=>{if(watch.current!==null)navigator.geolocation.clearWatch(watch.current);watch.current=null;sharingVehicle.current=null;setSharing(false);},[]);
 const load=useCallback(async()=>{
  if(!db||!site)return;
  const requestContext=context.current;
  const tables=['sites','stops','visits','rides','vehicles','parking_zones','iot_devices','audit_events','transport_routes'];
  const results=await Promise.all(tables.map(t=>{let q=db.from(t).select('*');q=t==='sites'?q.eq('id',site):q.eq('site_id',site);if(['visits','rides','audit_events'].includes(t))q=q.order('created_at',{ascending:false});return q.limit(100).abortSignal(AbortSignal.timeout(10000));}));
  if(context.current!==requestContext)return;
  const failure=results.find(r=>r.error);if(failure?.error){setData({});setError(failure.error.message);return;}
  setData(Object.fromEntries(tables.map((t,i)=>[t,results[i].data??[]])));
 },[site]);
 useEffect(()=>{
  if(!db){setReady(true);return;}
  const {data:{subscription}}=db.auth.onAuthStateChange((_e,s)=>{
   const next=s?.user.id??null;
   if(userId.current!==next){userId.current=next;setData({});setMembers([]);setSite('');setInvite('');setQr('');stop();}
   setSession(s);setReady(true);
  });
  void db.auth.getSession().then(({error})=>{if(error){setError('Session unavailable. Retry when connected.');setReady(true);}}).catch(()=>{setError('Session unavailable. Retry when connected.');setReady(true);});
  return ()=>subscription.unsubscribe();
 },[stop]);
 useEffect(()=>{
  if(!session?.user.id||!db)return;
  let active=true;
  void db.from('memberships').select('*').then(({data,error})=>{if(!active)return;if(error)setError(error.message);else{setMembers(data??[]);setSite(data?.[0]?.site_id??'');setTab(data?.[0]?.role==='LOADER'?'Loading':'Overview');}});
  return()=>{active=false;};
 },[session?.user.id]);
 useEffect(()=>{
  setPlatform(false);setPlatformReady(false);setPlatformError('');if(!db||!session?.user.id)return;let active=true;
  const refresh=()=>{void db.from('platform_admins').select('user_id').eq('user_id',session.user.id).eq('active',true).limit(1).abortSignal(AbortSignal.timeout(10000)).then(({data,error})=>{if(!active)return;setPlatform(!error&&!!data?.length);setPlatformError(error?.message??'');setPlatformReady(true);}).catch(error=>{if(active){setPlatform(false);setPlatformError(error instanceof Error?error.message:'Platform permission lookup unavailable');setPlatformReady(true);}});};
  refresh();const timer=setInterval(refresh,30000);return()=>{active=false;clearInterval(timer);};
 },[session?.user.id]);
 useEffect(()=>{const change=()=>{stop();setHash(location.hash);setMessage('');setError('');};window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[stop]);
 useEffect(()=>{setInvite('');setQr('');},[site]);
 useEffect(()=>{stop();setData({});void load();if(!db||!site)return;const channel=db.channel(`site:${site}`).on('postgres_changes',{event:'*',schema:'public',filter:`site_id=eq.${site}`},()=>void load()).subscribe(status=>{setConnection(status==='SUBSCRIBED'?'Realtime connected':`${status} · polling fallback`);if(status==='SUBSCRIBED')void load();});const timer=setInterval(()=>void load(),15000);const online=()=>{void load();};window.addEventListener('online',online);return ()=>{void db.removeChannel(channel);clearInterval(timer);window.removeEventListener('online',online);stop();};},[site,load,stop]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),5000);return ()=>clearInterval(timer);},[]);
 useEffect(()=>{if(tab!=='Transportation')stop();},[tab,stop]);
 useEffect(()=>{if(sharingVehicle.current&&!(data.vehicles??[]).some(v=>v.id===sharingVehicle.current&&v.shift_active))stop();},[data.vehicles,stop]);
 useEffect(()=>{if(!invite)return;void QRCode.toDataURL(invite,{width:240,margin:2}).then(setQr).catch(()=>setError('QR creation failed. Use the invitation link.'));},[invite]);
 async function action(fn:()=>Promise<unknown>,success='Saved to Supabase'){setBusy(true);setError('');setMessage('');try{await fn();setMessage(success);await load();}catch(e){setError(e instanceof Error?e.message:'Request failed. Retry when connected.');}finally{setBusy(false);}}
 async function rpc(name:string,args:Record<string,unknown>){if(!db)throw Error('Supabase is not configured');const {data,error}=await db.rpc(name,args);if(error)throw Error(error.message);return data;}
 function fields(e:FormEvent<HTMLFormElement>){e.preventDefault();return new FormData(e.currentTarget);}
 function gps(v:Row){if(!navigator.geolocation){setError('Geolocation unavailable on this device');return;}stop();sharingVehicle.current=String(v.id);last.current=0;setSharing(true);watch.current=navigator.geolocation.watchPosition(p=>{if(Date.now()-last.current<5000)return;last.current=Date.now();void rpc('telemetry',{p_vehicle:v.id,p_lat:p.coords.latitude,p_lng:p.coords.longitude,p_accuracy:p.coords.accuracy,p_observed:new Date(p.timestamp).toISOString(),p_simulated:false}).catch(e=>{setError(e.message);stop();});},e=>{setError(`Location unavailable: ${e.message}`);stop();},{enableHighAccuracy:true,maximumAge:0,timeout:15000});}
 const notices=<>{error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}</>;
 if(!db)return <Welcome configured={false}/>;
 if(token)return <GuestRegistration key={token} db={db} token={token} intent={arrivalIntent}/>;
 if(checkinToken)return <PublicCheckin key={checkinToken} db={db} token={checkinToken} intent={arrivalIntent}/>;
 if(!ready)return <main>Checking your session…</main>;
 if(!session)return <Welcome configured>{notices}<form className="login-form" onSubmit={e=>{const f=fields(e);void action(async()=>{const {error}=await db.auth.signInWithPassword({email:String(f.get('email')),password:String(f.get('password'))});if(error)throw error;},'');}}><label>Email<input type="email" name="email" autoComplete="username" placeholder="you@example.com" required/></label><label>Password<input type="password" name="password" autoComplete="current-password" placeholder="Enter your password" required/></label><button disabled={busy}>Sign in <Icon name="arrow"/></button></form></Welcome>;
 const rides=data.rides??[],visits=data.visits??[],vehicles=data.vehicles??[];
 if(staffToken)return <StaffAcceptance key={staffToken} db={db} token={staffToken}/>;
 const loadingManager=m?.role==='LOADER'||can('loading.manage')||['SITE_MANAGER','TOWNSHIP_ADMIN'].includes(m?.role??'');
  const isOperator=m?.role==='PLATFORM_OPERATOR';
  const tabs=isOperator?['Overview',...(platform?['Platform']:[]),'Account','Privacy']:m?.role==='LOADER'?['Loading','Parking','Account','Privacy']:['Overview','Transportation','MyVisitor','Parking',...(loadingManager?['Loading']:[]),'Account','Privacy',...(can('visits.forms.manage')?['Forms']:[]),...(['staff.manage','fleet.configure','parking.configure'].some(can)?['Administration']:[]),...(can('analytics.read')?['Analytics']:[]),...(platform?['Platform']:[]),...(can('audit.read')?['Audit']:[])];
 const navigate=(t:string)=>{setTab(t);setMessage('');setError('');};
 const siteName=String(data.sites?.[0]?.name??'Your township');
 return <AppShell tabs={tabs} tab={tab} onNavigate={navigate} role={m?.role.replaceAll('_',' ')??'No membership'} site={site} sites={members.map(x=>({id:x.site_id,name:x.site_id===site?siteName:x.role.replaceAll('_',' ')+' · '+x.site_id.slice(0,8)}))} onSite={setSite} siteName={siteName} email={session.user.email??''} busy={busy} connection={connection} onSignOut={()=>void action(async()=>{stop();const {error}=await db.auth.signOut({scope:'local'});if(error)throw error;},'Signed out')}>
 <div className="title"><div><span className="eyebrow">{tab==='Overview'?'YOUR EVERYDAY, REIMAGINED':siteName}</span><h1>{tab==='Overview'?(isOperator?'Township operations.':'Hello, neighbour.'):tab==='Transportation'?'Where are we heading?':tab==='MyVisitor'?'Good company starts here.':tab==='Parking'?'A space for your next stop.':tab==='Loading'?'Loading dock operations.':tab}</h1><p className="muted">{tab==='Overview'?(isOperator?'Your full cross-township control centre, with real demo statistics.':'A little less planning. A little more living.'):tab==='Transportation'?'Your community. One journey at a time.':tab==='MyVisitor'?'Thoughtful welcomes. Simple, secure arrivals.':tab==='Parking'?'Find a mall, choose a floor and see available spaces.':tab==='Loading'?'Record delivery arrivals and departures without a paper logbook.':'Everything you need, with the access that’s right for you.'}</p></div><button className="refresh-button" aria-label="Refresh" disabled={busy} onClick={()=>void action(load,'Refreshed')}><Icon name="refresh"/><span>Refresh</span></button></div>
 <div className="banner"><span className="prototype-dot"/><strong>DEMONSTRATION</strong><span>Fictional services · Simulated sources labelled · No guaranteed availability</span></div>{notices}{!site&&<p className="empty-state">No site access. Ask your administrator to provision membership. Your account reference: {session.user.id}</p>}
 {tab==='Overview'&&isOperator?(platformReady?(platform?<OperatorDashboard key={session.user.id} db={db} onNavigate={navigate}/>:<OperatorAccessNotice reason={platformError}/>):<p role="status">Checking platform operator access…</p>):tab==='Overview'&&<HomeDashboard data={data} now={now} onNavigate={navigate}/>}
 {tab==='MyVisitor'&&<>{can('visits.forms.manage')&&<SiteCheckinIssuer key={`walkin:${session.user.id}:${site}`} db={db} site={site}/>}<h2>Invite a guest personally</h2>{can('visits.invite')&&<button disabled={busy} onClick={()=>void action(async()=>{const r=await rpc('create_invitation',{p_site:site});setInvite(`${location.origin}${location.pathname}#invite=${r.token}`);},'Invitation created. Link expires in 24 hours and can be used once.')}>Create guest invitation</button>}{invite&&<article><img src={qr} alt="Invitation QR code" width="240" height="240"/><p><a href={invite}>Open private guest registration</a></p><p>Share this private one-use link carefully. Opening it may store it in your browser history.</p></article>}<h2>{can('visits.read.site')?'Site visitor queue':'Your invited visitors'}</h2><div className="cards">{visits.map(v=><article key={String(v.id)}><h3>{v.guest_name}</h3><p>{String(v.status).replaceAll('_',' ')}</p><small>{String(v.id).slice(0,8)} · {time(v.created_at)}</small><VisitFormAnswers db={db} visit={String(v.id)}/>{can('visits.checkin')&&v.status!=='departed'&&<button disabled={busy} onClick={()=>void action(()=>rpc('visit_transition',{p_id:v.id,p_status:v.status==='pending_entry'?'onsite':'departed'}),'Visit updated')}>{v.status==='pending_entry'?'Verify & check in':'Check out'}</button>}</article>)}</div>{!visits.length&&<p>No visible registrations. Create an invitation to start.</p>}</>}
 {tab==='Forms'&&can('visits.forms.manage')&&<VisitorFormManager key={`${session.user.id}:${site}`} db={db} site={site}/>}
 
 {tab==='Administration'&&<SiteAdministration key={`administration:${session.user.id}:${site}`} db={db} site={site} user={session.user.id} capabilities={m?.capabilities??[]}/>}
 {tab==='Administration'&&m?.role==='TOWNSHIP_ADMIN'&&can('sites.manage')&&<TownshipSiteCreator key={`township:${m.tenant_id}`} db={db} tenant={m.tenant_id}/>}
 {tab==='Platform'&&platform&&<PlatformAdministration key={`platform:${session.user.id}`} db={db}/>}
 {tab==='Account'&&<AccountSecurity key={`account:${session.user.id}`} db={db} user={session.user.id}/>}
 {tab==='Privacy'&&site&&<PrivacyRequests key={`privacy:${session.user.id}:${site}`} db={db} site={site} user={session.user.id} review={can('privacy.review')} hold={can('privacy.hold')}/>}
 {tab==='Analytics'&&can('analytics.read')&&<SiteAnalytics key={`analytics:${session.user.id}:${site}`} db={db} site={site}/>}
 {tab==='MyVisitor'&&can('visits.read.site')&&<VisitorRecords key={`${session.user.id}:${site}`} db={db} site={site} canExport={can('exports.visits')}/>}
 {tab==='MyVisitor'&&can('visits.assist')&&<GuardAssistance key={`assistance:${session.user.id}:${site}`} db={db} site={site} onSaved={load}/>}
 {tab==='Loading'&&loadingManager&&<LoadingDock key={`loader:${session.user.id}:${site}`} db={db} site={site} canExport={['SITE_MANAGER','TOWNSHIP_ADMIN'].includes(m?.role??'')}/>}
  {tab==='Parking'&&<ParkingPanel key={`parking:${session.user.id}:${site}`} db={db} site={site} capabilities={m?.capabilities??[]} now={now}/>}
 {tab==='Transportation'&&<><MobilityNetwork routes={(data.transport_routes??[]) as unknown as MobilityRoute[]} vehicles={vehicles} rides={rides}/>{can('rides.request')&&<article className="booking-panel"><span className="booking-label"><Icon name="ride"/>COMMUNITY TRANSPORT</span><h2>Request a shuttle</h2><p>Choose your stops. Your dispatcher confirms the ride; arrival estimates are unavailable until a routing provider is connected.</p><form className="inline" onSubmit={e=>{const f=fields(e);const id=crypto.randomUUID();void action(()=>rpc('request_ride',{p_id:id,p_site:site,p_pickup:f.get('pickup'),p_destination:f.get('destination'),p_accessible:f.get('accessible')==='on'}),'Ride requested; awaiting dispatcher');}}><label>Pickup<select name="pickup" required>{(data.stops??[]).map(s=><option key={String(s.id)}>{s.name}</option>)}</select></label><label>Destination<select name="destination" required defaultValue="Demo Mall">{(data.stops??[]).map(s=><option key={String(s.id)}>{s.name}</option>)}</select></label><label className="check"><input type="checkbox" name="accessible"/>Accessible vehicle needed</label><button disabled={busy}>Request ride</button></form></article>}<h2>Rides</h2><div className="cards">{rides.map(r=><article className="journey-card" key={String(r.id)}><h3>{r.pickup} → {r.destination}</h3><p className="ride-status">{r.status} {r.accessible?'· Accessible vehicle required':''}</p><small>{time(r.updated_at)}</small>{r.resident_id===session.user.id&&['requested','assigned'].includes(String(r.status))&&<button disabled={busy} onClick={()=>void action(()=>rpc('ride_transition',{p_id:r.id,p_status:'cancelled'}),'Ride cancelled')}>Cancel</button>}{can('fleet.dispatch')&&r.status==='requested'&&<form onSubmit={e=>{const f=fields(e);void action(()=>rpc('assign_ride',{p_ride:r.id,p_vehicle:f.get('vehicle')}),'Ride assigned');}}><label>Assign vehicle<select name="vehicle" required><option value="">Choose active vehicle</option>{vehicles.filter(v=>v.shift_active).map(v=><option key={String(v.id)} value={String(v.id)}>{v.name} · {v.capacity} seats</option>)}</select></label><button disabled={busy}>Assign with capacity check</button></form>}{can('fleet.dispatch')&&['requested','assigned'].includes(String(r.status))&&<DispatchOptions key={`dispatch:${r.id}:${r.vehicle_id??''}`} db={db} ride={String(r.id)} assigned={r.status==='assigned'?String(r.vehicle_id):null} onSaved={load}/>}{can('fleet.drive')&&['assigned','boarded'].includes(String(r.status))&&<button disabled={busy} onClick={()=>void action(()=>rpc('ride_transition',{p_id:r.id,p_status:r.status==='assigned'?'boarded':'completed'}),'Ride updated')}>{r.status==='assigned'?'Confirm boarding':'Complete ride'}</button>}</article>)}</div>{!rides.length&&<p>No rides visible to your account.</p>}<h2>Authorized vehicles</h2><div className="cards">{vehicles.map(v=><article key={String(v.id)}><span className="badge">{v.simulated?'SIMULATED GPS':'GPS'} · {freshness(v.observed_at as string,now,60000)}</span><h3>{v.name}</h3><p>{v.capacity} seats · {v.accessible?'Accessible':'Standard'} · {v.shift_active?'Shift active':'Off shift'}</p><p>{freshness(v.observed_at as string,now,60000)==='unknown'?'Location unavailable':`${v.lat}, ${v.lng} · accuracy ${v.accuracy} m`}</p><small>{time(v.observed_at)}</small>{can('fleet.drive')&&v.driver_id===session.user.id&&<><button disabled={busy} onClick={()=>{stop();void action(()=>rpc('set_shift',{p_vehicle:v.id,p_active:!v.shift_active}),'Shift updated');}}>{v.shift_active?'End shift':'Start shift'}</button>{v.shift_active&&<><button onClick={()=>sharing?stop():gps(v)}>{sharing?'Stop GPS sharing':'Consent & share GPS'}</button><button disabled={busy} className="secondary" onClick={()=>void action(()=>rpc('telemetry',{p_vehicle:v.id,p_lat:3.16,p_lng:101.51,p_accuracy:12,p_observed:new Date().toISOString(),p_simulated:true}),'Simulated GPS point saved')}>Send simulated GPS</button><p>Browser background GPS may pause. Sharing ends on site change, logout or leaving this page.</p></>}</>}</article>)}</div></>}
 {tab==='Transportation'&&<TransportRoutes key={`routes:${session.user.id}:${site}`} db={db} site={site} stops={(data.stops??[]).map(s=>String(s.name))} configure={can('fleet.configure')}/>}
 {tab==='Audit'&&can('audit.read')&&<><h2>Site activity audit</h2><p>Authorized operations at this site. Record identifiers support investigation; this view does not expose guest names, invitation tokens or GPS coordinates.</p><div className="cards">{(data.audit_events??[]).map(event=><article key={String(event.id)}><h3>{event.action}</h3><p>{time(event.created_at)}</p><small>Record: {event.record_id??'None'}</small><small>Actor: {event.actor??'Purpose-limited guest flow'}</small></article>)}</div>{!data.audit_events?.length&&<p>No audit events visible at this site.</p>}</>}
 </AppShell>;
}
function time(v:unknown){return v?new Date(String(v)).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'}):'No observation';}
createRoot(document.getElementById('root')!).render(<Boundary><App/></Boundary>);

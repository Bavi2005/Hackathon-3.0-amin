import {useCallback,useEffect,useRef,useState,type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {zoneAvailability,currentBayStatus,type ParkingOverview} from '../../../packages/contracts/parking-overview';

type Session={id:string;facility_id:string;level_id:string;vehicle_ref:string;delivery_ref:string;status:'loading'|'departed';checked_in_at:string;checked_out_at:string|null;facility_name:string;level_name:string};
type Dashboard={sessions:Session[];active:number;today:number;departed:number;server_time:string};
type ExportRow={id:string;vehicle_ref:string;delivery_ref:string;facility:string;level:string;status:string;checked_in_at:string;checked_out_at:string|null};
function csv(rows:ExportRow[]):string{
 const value=(raw:unknown)=>{let cell=String(raw??'');if (/^[\s]*[=+@-]/.test(cell))cell="'"+cell;return '"'+cell.replaceAll('"','""')+'"';};
 return ['Reference,Vehicle,Delivery,Mall,Level,Status,Arrival (UTC),Departure (UTC)',
 ...rows.map(r=>[r.id,r.vehicle_ref,r.delivery_ref,r.facility,r.level,r.status,r.checked_in_at,r.checked_out_at].map(value).join(','))].join('\r\n');
}
export function LoadingDock({db,site,canExport}:{db:SupabaseClient;site:string;canExport:boolean}){
 const [data,setData]=useState<Dashboard|null>(null),[parking,setParking]=useState<ParkingOverview|null>(null);
 const [facility,setFacility]=useState(''),[level,setLevel]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[exportReason,setExportReason]=useState('');
 const lifetime=useRef(new AbortController()),request=useRef(crypto.randomUUID());
 const rpc=useCallback(async(name:string,args:Record<string,unknown>)=>{
  const {data,error}=await db.rpc(name,args).abortSignal(AbortSignal.any([lifetime.current.signal,AbortSignal.timeout(15000)]));
  if(error)throw Error(error.message);return data;
 },[db]);
 const load=useCallback(async()=>{
  const [sessions,overview]=await Promise.all([rpc('get_loading_dashboard',{p_site:site}),rpc('get_parking_overview',{p_site:site})]);
  if(lifetime.current.signal.aborted)return;
  setData(sessions as Dashboard);setParking(overview as ParkingOverview);
 },[rpc,site]);
 useEffect(()=>{const controller=new AbortController();lifetime.current=controller;void load().catch(e=>{if(!controller.signal.aborted)setError(e.message);});const timer=setInterval(()=>void load().catch(()=>{}),15000);return()=>{controller.abort();clearInterval(timer);};},[load]);
 const floors=parking?.levels.filter(l=>l.facility_id===facility)??[];
 async function run(work:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setMessage('');try{await work();}catch(e){if(!lifetime.current.signal.aborted)setError(e instanceof Error?e.message:'Loading desk unavailable');}finally{if(!lifetime.current.signal.aborted)setBusy(false);}}
 function start(e:FormEvent<HTMLFormElement>){e.preventDefault();const form=e.currentTarget;const fields=new FormData(form);void run(async()=>{
  await rpc('start_loading_session',{p_site:site,p_request:request.current,p_facility:facility,p_level:level,p_vehicle:fields.get('vehicle'),p_delivery:fields.get('delivery')});
  if(lifetime.current.signal.aborted)return;request.current=crypto.randomUUID();form.reset();setMessage('Vehicle checked in. Server timestamp and audit event recorded.');await load();
 });}
 function finish(id:string){void run(async()=>{await rpc('finish_loading_session',{p_id:id});if(lifetime.current.signal.aborted)return;setMessage('Loading vehicle departure recorded on the server.');await load();});}
 function exportCsv(){void run(async()=>{
  if(!exportReason)throw Error('Choose an export purpose');
  const result=await rpc('export_loading_records',{p_site:site,p_reason:exportReason}) as {records:ExportRow[];count:number};
  if(lifetime.current.signal.aborted)return;
  const url=URL.createObjectURL(new Blob(['\uFEFF',csv(result.records)],{type:'text/csv;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='loading-dock-'+new Date().toISOString().slice(0,10)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  setMessage('Audited loading log export prepared: '+result.count+' records. Store securely.');
 });}
 const localTime=(t:string|null)=>t?new Date(t).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur',dateStyle:'medium',timeStyle:'short'}):'—';
 return <section className="loading-dock" aria-label="Loading dock operations">
   <div className="loading-banner"><div><span className="garage-overline">SMARTTOWNSHIP / GOODS ARRIVAL</span><h2>Loading made effortless.</h2><p>Choose a mall, record a delivery vehicle when it arrives, and check it out when loading finishes. Entries are timestamped and audited on the server—no paper book.</p><span className="loading-demo-pill">DEMO · REAL WORKFLOW, FICTIONAL DATA</span></div><div className="loading-banner-emblem" aria-hidden="true"><span>P</span><small>LOADING</small></div></div>
   {error&&<p role="alert" className="error">{error}</p>}{message&&<p role="status" className="success">{message}</p>}
   <button className="secondary" disabled={busy} onClick={()=>void run(async()=>{await load();setMessage('Loading desk refreshed.');})}>Refresh loading desk</button>
   {data&&<div className="loading-metrics"><div><span>LOADING NOW</span><strong>{data.active}</strong><small>Vehicles currently checked in</small></div><div><span>ARRIVALS TODAY</span><strong>{data.today}</strong><small>Malaysia local calendar day</small></div><div><span>COMPLETED</span><strong>{data.departed}</strong><small>Departures recorded</small></div><div><span>MALL LOCATIONS</span><strong>{parking?.facilities.length??0}</strong><small>Configured facilities</small></div></div>}
   <div className="loading-workflow"><article className="loading-form-card"><span className="garage-overline red">01 / ARRIVAL DESK</span><h3>Register a loading vehicle</h3><p>Visitors and delivery drivers can first scan the venue's public MyVisitor QR. Loading staff then record vehicle arrival here; this step does not reserve a bay or guarantee access.</p>
    <form onChange={()=>{request.current=crypto.randomUUID();}} onSubmit={start}><fieldset disabled={busy||!parking?.facilities.length}><legend>New loading arrival</legend>
      <label>Mall / venue<select required value={facility} onChange={e=>{setFacility(e.target.value);setLevel('');}}><option value="">Choose a mall</option>{parking?.facilities.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>
      <label>Parking level / loading location<select required value={level} onChange={e=>setLevel(e.target.value)}><option value="">Choose a level</option>{floors.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
      <label>Vehicle registration<input name="vehicle" required maxLength={32} minLength={2} placeholder="e.g. DEMO 1234" autoComplete="off"/></label>
      <label>Delivery / job reference<input name="delivery" required maxLength={80} minLength={2} placeholder="e.g. DEMO DELIVERY-1001" autoComplete="off"/></label>
      <button type="submit" disabled={busy||!level}>Check in vehicle →</button>
    </fieldset></form>
   </article><article className="loading-spaces-card"><span className="garage-overline red">02 / PARKING INTELLIGENCE</span><h3>Loading area availability</h3><p>Choose a mall and floor to inspect its configured spaces. Individual free/occupied states are shown only when bay sensors are configured.</p>
     {parking&&parking.facilities.length>0&&!facility&&<p className="loading-empty">Select a mall in the arrival form to see its levels.</p>}
     {parking&&facility&&!level&&<p className="loading-empty">Select a parking level to view reported occupancy.</p>}
     {parking&&level&&<>{parking.zones.filter(z=>z.level_id===level).map(z=>{const a=zoneAvailability(z,Date.now());return <div className="loading-zone-result" key={z.id}><div><strong>{z.name}</strong><span>{a.source}</span></div><strong>{a.free===null?'Unknown':a.free+' free'}</strong>{z.kind==='bay'&&<div className="loading-mini-bays">{z.bays.map(b=><span className={'mini-bay '+currentBayStatus(b,Date.now()).toLowerCase()} key={b.id} title={b.label+' · '+currentBayStatus(b,Date.now())}>{b.label}</span>)}</div>}</div>})}</>}
     <p className="loading-privacy-note">Availability is informational only. Stale readings become unknown. The visitor QR form and loading log remain separate records.</p>
   </article></div>
   <section className="loading-history" aria-label="Loading vehicle history"><div className="garage-title-row"><div><span className="garage-overline red">03 / OPERATIONS LOG</span><h3>Vehicle arrivals & departures</h3></div><small>Most recent 100 · server time</small></div>
     {data?.sessions.length? <div className="loading-table-wrap"><table><thead><tr><th>Vehicle & job</th><th>Mall / level</th><th>Arrived</th><th>Status</th><th>Action</th></tr></thead><tbody>{data.sessions.map(r=><tr key={r.id}><td><strong>{r.vehicle_ref}</strong><small>{r.delivery_ref}</small></td><td>{r.facility_name}<small>{r.level_name}</small></td><td>{localTime(r.checked_in_at)}</td><td><span className={'loading-status '+r.status}>{r.status==='loading'?'● Loading':'✓ Departed'}</span></td><td>{r.status==='loading'?<button disabled={busy} onClick={()=>finish(r.id)}>Check out</button>:<small>{localTime(r.checked_out_at)}</small>}</td></tr>)}</tbody></table></div>:<p className="loading-empty">No loading vehicles registered yet. New entries will appear here.</p>}
   </section>
   {canExport&&<section className="loading-export" aria-label="Loading record export"><div><span className="garage-overline red">ADMINISTRATION / RECORDS</span><h3>Keep your operational records.</h3><p>Site managers can export up to 1,000 loading entries as an audited CSV. The download includes vehicle and job references; store it securely and follow your retention policy.</p></div><form onSubmit={e=>{e.preventDefault();exportCsv();}}><label>Reason for export<select value={exportReason} onChange={e=>setExportReason(e.target.value)} required><option value="">Choose purpose</option><option value="operations_review">Operations review</option><option value="incident_review">Incident review</option></select></label><button disabled={busy||!exportReason}>Download loading CSV ↓</button></form></section>}
 </section>;
}

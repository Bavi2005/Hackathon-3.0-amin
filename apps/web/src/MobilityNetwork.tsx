import {Icon} from './Icon';

type Row=Record<string,string|number|boolean|null>;
export type Route={id:string;name:string;stop_names:string[];start_minute:number;end_minute:number;headway_minutes:number;published:boolean};
const clock=(value:number)=>String(Math.floor(value/60)).padStart(2,'0')+':'+String(value%60).padStart(2,'0');
export function MobilityNetwork({routes,vehicles,rides}:{routes:Route[];vehicles:Row[];rides:Row[]}){
 const published=routes.filter(r=>r.published);
 const pending=rides.filter(r=>r.status==='requested').length;
 const completed=rides.filter(r=>r.status==='completed').length;
 return <section className="mobility-network" aria-label="Community mobility network">
   <div className="mobility-network-header"><div><span className="eyebrow">TOWNSHIP PULSE / COMMUNITY MOBILITY</span><h2>Every corner, connected.</h2><p>A fictional network of community pickup points. Routes are configured timetables, not live GPS tracks or arrival guarantees.</p></div><div className="mobility-stat"><Icon name="ride"/><strong>{vehicles.length}</strong><span>shuttles on record</span></div></div>
   <div className="mobility-overview"><div><span className="mobility-metric-label">PUBLISHED ROUTES</span><strong>{published.length}</strong></div><div><span className="mobility-metric-label">AWAITING DISPATCH</span><strong>{pending}</strong></div><div><span className="mobility-metric-label">COMPLETED RIDES</span><strong>{completed}</strong></div><div><span className="mobility-metric-label">ON SHIFT NOW</span><strong>{vehicles.filter(v=>v.shift_active).length}</strong></div></div>
   <div className="mobility-routes">
    {published.slice(0,4).map((r,index)=><article key={r.id} className="mobility-route">
      <div className="mobility-route-title"><div><span className="mobility-route-id">ROUTE {String(index+1).padStart(2,'0')}</span><h3>{r.name}</h3></div><span className="mobility-headway">Every {r.headway_minutes} min</span></div>
      <div className="mobility-stops">{r.stop_names.map((stop,index)=><div className="mobility-stop" key={stop+':'+index}><span className={index===0||index===r.stop_names.length-1?'mobility-node endpoint':'mobility-node'}/><strong>{stop}</strong></div>)}</div>
      <p className="mobility-route-time"><Icon name="clock"/> Fictional timetable {clock(r.start_minute)}–{clock(r.end_minute)} MYT · Arrival time is not predicted</p>
    </article>)}
    {!published.length&&<p className="mobility-empty">No route published yet. A township administrator can publish the stop timetable under Transportation.</p>}
   </div>
 </section>;
}

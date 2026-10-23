import {useEffect,useMemo,useState} from 'react';
import {currentBayStatus,zoneAvailability,type ParkingOverview,type ParkingZone} from '../../../packages/contracts/parking-overview';

type Facility = ParkingOverview['facilities'][number];
type Group = {free:number;capacity:number;unknown:number;reporting:number};
function overview(zones:ParkingZone[],now:number):Group{
 return zones.reduce((a,z)=>{const availability=zoneAvailability(z,now);a.capacity+=z.capacity;if(availability.free===null)a.unknown+=z.capacity;else {a.free+=availability.free;a.reporting++;}return a;},{free:0,capacity:0,unknown:0,reporting:0});
}
function count(g:Group){return g.reporting===0?'Unknown':g.unknown?String(g.free)+' known free':String(g.free)+' free';}
export function ParkingExplorer({data,now}: {data:ParkingOverview;now:number}){
 const [facilityId,setFacilityId]=useState<string | null>(null),[levelId,setLevelId]=useState<string | null>(null);
 const facilities=useMemo(()=>data.facilities, [data.facilities]);
 const unassigned=data.zones.filter(z=>!z.level_id);
 const selected=facilities.find(f=>f.id===facilityId);
 const floors=data.levels.filter(l=>l.facility_id===facilityId);
 const currentLevel=floors.find(l=>l.id===levelId);
 const selectedZones=data.zones.filter(z=>z.level_id===levelId);
 const facilityZones=(f:Facility)=>data.zones.filter(z=>data.levels.some(l=>l.facility_id===f.id&&l.id===z.level_id));
 useEffect(()=>{if(facilityId&&!facilities.some(f=>f.id===facilityId)){setFacilityId(null);setLevelId(null);}},[facilities,facilityId]);
 const all=overview(data.zones,now);
 return <section className="garage-explorer" aria-label="Mall parking explorer">
   <div className="garage-intro"><div><span className="garage-overline">SMARTTOWNSHIP <span> / </span> PARKING</span><h2>Park smarter.<br/><em>Know before you go.</em></h2><p>Browse a mall, open a floor, and inspect individually monitored spaces. Demonstration readings refresh from the backend; not real-world live availability.</p><div className="garage-legend"><span><i className="garage-dot free"/> Free</span><span><i className="garage-dot busy"/> Occupied</span><span><i className="garage-dot stale"/> Unknown / stale</span><span><i className="garage-dot closed"/> Out of service</span></div></div>
     <div className="garage-pulse"><small>SITE PARKING PULSE</small><strong>{all.reporting?all.free:'—'}</strong><span>{all.unknown?'known free · partial data':'spaces free'}</span><small>{all.capacity} configured spaces · {all.reporting} reporting zones</small></div>
   </div>
   {selected&&<nav aria-label="Parking hierarchy" className="garage-breadcrumb"><button onClick={()=>{setFacilityId(null);setLevelId(null);}}>All malls</button><span>/</span><button onClick={()=>setLevelId(null)}>{selected.name}</button>{currentLevel&&<><span>/</span><strong>{currentLevel.name}</strong></>}</nav>}
   {!selected&&<><div className="garage-title-row"><div><span className="garage-overline red">STEP 01 · CHOOSE YOUR DESTINATION</span><h3>Malls & parking locations</h3></div><small>Tap a location to explore levels <span aria-hidden="true">↗</span></small></div>
   <div className="garage-facility-grid">{facilities.map((f,index)=>{const group=overview(facilityZones(f),now),floorCount=data.levels.filter(l=>l.facility_id===f.id).length;return <button className="garage-facility" key={f.id} aria-label={`View ${f.name} parking levels`} onClick={()=>{setFacilityId(f.id);setLevelId(null);}}><span className="garage-index">0{index+1} / DESTINATION</span><span className="garage-facility-icon" aria-hidden="true">P</span><h4>{f.name}</h4><p>{f.details||'Explore parking levels, counts and monitored bays'}</p><div className="garage-facility-footer"><div><strong>{count(group)}</strong><small>{group.capacity} spaces · {floorCount} levels{group.unknown?' · partial coverage':''}</small></div><span className="garage-next">↗</span></div></button>})}</div>
   {!facilities.length&&<p>No parking facilities configured yet. Ask site administration to create a facility and level.</p>}
   {unassigned.length>0&&<div className="garage-info"><strong>Other monitored site zones</strong><span>{count(overview(unassigned,now))} · Not yet assigned to a parking facility</span></div>}
   </>}
   {selected&&!currentLevel&&<><div className="garage-title-row"><div><span className="garage-overline red">STEP 02 · PICK YOUR FLOOR</span><h3>{selected.name}</h3><p>{selected.details}</p></div><small>Choose a level for occupancy details</small></div>
   <div className="garage-floor-grid">{floors.map((level,index)=>{const z=data.zones.filter(x=>x.level_id===level.id),g=overview(z,now);return <button key={level.id} className="garage-floor" aria-label={`View ${level.name} bays`} onClick={()=>setLevelId(level.id)}><span className="garage-floor-index">LEVEL {String(index+1).padStart(2,'0')}</span><span className="garage-floor-symbol">P</span><h4>{level.name}</h4><div className="garage-floor-divider"/><strong>{count(g)}</strong><p>{g.capacity} configured spaces · {z.length} zones</p><span className="garage-floor-action">View bay layout <span>→</span></span></button>})}</div>{!floors.length&&<p>No levels configured for this facility.</p>}</>}
   {currentLevel&&<><div className="garage-title-row"><div><span className="garage-overline red">STEP 03 · CHECK THE SPACES</span><h3>{currentLevel.name}</h3><p>{selected?.name} · Per-bay status is shown only for configured bay sensors. Counter-only zones provide aggregate totals, not individual occupancy.</p></div><small>Latest available observed status</small></div>
   <div className="garage-floor-summary">{(()=>{const g=overview(selectedZones,now);return <><div><small>KNOWN FREE</small><strong>{g.free}</strong></div><div><small>CAPACITY</small><strong>{g.capacity}</strong></div><div><small>UNVERIFIED</small><strong>{g.unknown}</strong></div><div><small>MONITORED ZONES</small><strong>{g.reporting}/{selectedZones.length}</strong></div></>})()}</div>
   {selectedZones.map(z=>{const a=zoneAvailability(z,now);return <article className="garage-zone" key={z.id}><header><div><span className="garage-overline">{z.kind==='bay'?'INDIVIDUAL BAY TRACKING':'AGGREGATE COUNTER'}</span><h4>{z.name}</h4></div><div className="garage-zone-count"><strong>{a.free===null?'Unknown':`${a.free} free`}</strong><small>{a.source} · {z.capacity} spaces</small></div></header>
   {z.kind==='bay'?<><div className="garage-aisle"><span>ENTRY →</span><span>DRIVE AISLE</span><span>→ EXIT</span></div><div className="garage-bay-map">{z.bays.map(b=>{const status=currentBayStatus(b,now);return <div className={`garage-bay garage-bay-${status.toLowerCase()}`} key={b.id} title={`${b.label}: ${status}`}><span className="garage-bay-icon" aria-hidden="true">▰</span><strong>{b.label}</strong><small>{status==='OUT_OF_SERVICE'?'CLOSED':status}</small>{b.accessible&&<span className="garage-accessible">♿</span>}</div>})}</div><p className="garage-freshness">{z.bays.length} of {z.capacity} configured bays · Unreported or expired readings appear unknown. No automatic booking.</p></>:<><div className="garage-counter"><div className="garage-counter-line"><span style={{width:`${a.free===null?0:Math.max(0,Math.min(100,100*(z.capacity-a.free)/z.capacity))}%`}}/></div><p>{a.free===null?'Counter observation is missing or expired.':`${z.capacity-a.free} estimated occupied · ${a.free} free of ${z.capacity}`}</p></div><p className="garage-freshness">Source: {a.source} · {a.observed?new Date(a.observed).toLocaleString('en-MY',{timeZone:'Asia/Kuala_Lumpur'}):'No current observation'}</p></>}
   </article>})}{!selectedZones.length&&<p>This level has no configured parking zones.</p>}</>}
   <p className="garage-disclaimer">DEMO DATA · Occupancy updates depend on configured simulated devices or timed manual observations. Never treat an unknown or stale spot as available.</p>
 </section>;
}

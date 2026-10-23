import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {currentBayStatus, zoneAvailability, type ParkingOverview} from '../../../packages/contracts/parking-overview';

function ParkingAction({label, busy, children, submit}: {label: string; busy: boolean; children: ReactNode; submit: (fields: FormData, request: string) => Promise<void>}) {
  const request = useRef(crypto.randomUUID());
  return <form aria-label={label} onChange={() => {request.current = crypto.randomUUID();}} onSubmit={e => {e.preventDefault(); void submit(new FormData(e.currentTarget), request.current);}}>
    <fieldset disabled={busy}><legend>{label}</legend>{children}<button disabled={busy}>{label}</button></fieldset>
  </form>;
}
export function ParkingPanel({db, site, capabilities, now}: {db: SupabaseClient; site: string; capabilities: string[]; now: number}) {
  const [data, setData] = useState<ParkingOverview | null>(null), [error, setError] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false);
  const lifetime = useRef(new AbortController()), can = (cap: string) => capabilities.includes(cap);
  const load = useCallback(async() => {
    const {data, error} = await db.rpc('get_parking_overview', {p_site: site}).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
    if (lifetime.current.signal.aborted) return;
    if (error) throw Error(error.message); setData(data);
  }, [db, site]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    const refresh = () => {void load().catch(e => {if (!controller.signal.aborted) setError(e.message);});};
    refresh(); const timer = setInterval(refresh, 15000);
    const channel = db.channel(`parking-detail:${site}`).on('postgres_changes', {event: '*', schema: 'public', table: 'parking_bays', filter: `site_id=eq.${site}`}, refresh)
      .on('postgres_changes', {event: '*', schema: 'public', table: 'parking_zones', filter: `site_id=eq.${site}`}, refresh).subscribe();
    return () => {controller.abort(); clearInterval(timer); void db.removeChannel(channel);};
  }, [db, load, site]);
  async function save(name: string, args: Record<string, unknown>, success: string) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const {error} = await db.rpc(name, args).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
      if (lifetime.current.signal.aborted) return; if (error) throw Error(error.message);
      setMessage(success); await load();
    } catch (failure) {if (!lifetime.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Parking unavailable');}
    finally {if (!lifetime.current.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Parking availability"><p>Counter zones show estimates only. Individual bays appear only for configured bay sensors. Observations expire after 120 seconds; manual counts have an explicit expiry. Availability is not a reservation.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={busy} onClick={() => {setError(''); void load().catch(e => setError(e.message));}}>Refresh parking</button>
    {!data && !error && <p>Loading parking…</p>}
    {data && <><div className="parking-hero"><div><span className="eyebrow">SMART PARKING · DIGITAL TWIN</span><h2>Find a space. Skip the guesswork.</h2><p>See each facility, level and zone. These are fictional demo readings updated through the backend simulator; they are not measurements from a real mall.</p><div className="parking-hero-key"><span><i className="parking-key-dot free"/> Available</span><span><i className="parking-key-dot occupied"/> Occupied</span><span><i className="parking-key-dot unknown"/> Unknown / stale</span></div></div><div className="parking-hero-number"><strong>{data.zones.filter(z=>z.kind==='counter').reduce((total,z)=>total+(zoneAvailability(z,now).free??0),0)}</strong><span>simulated spaces free</span><small>Across fresh counter zones only</small></div></div>
    <div className="parking-network-stats">
      <div><strong>{data.facilities.length}</strong><span>Facilities</span></div><div><strong>{data.levels.length}</strong><span>Parking levels</span></div>
      <div><strong>{data.zones.length}</strong><span>Monitored zones</span></div><div><strong>{data.zones.filter(z=>zoneAvailability(z,now).free!==null).length}</strong><span>Zones reporting</span></div>
    </div><div className="parking-zones-grid">{data.zones.map(z => {
      const availability = zoneAvailability(z, now), device = data.devices.find(d => d.zone_id === z.id && !d.bay_id);
      return <article className="parking-zone-card" key={z.id}><div className="parking-zone-heading"><span className="badge">{availability.source}</span><span className={availability.free===null?'parking-source stale':'parking-source'}>{availability.free===null?'● STALE / UNKNOWN':'● CURRENT DEMO'}</span></div><h2>{z.name}</h2>
        {(z.facility_name || z.level_name) && <p>{z.facility_name} / {z.level_name}</p>}
        <strong className="count">{availability.free === null ? 'Unknown' : `${availability.free} free`}</strong><div className="parking-capacity-bar" aria-hidden="true"><span style={{width:availability.free===null?'0%':`${Math.round(100*availability.free/z.capacity)}%`}}/></div>
        <p>Capacity {z.capacity} · {availability.observed ? new Date(availability.observed).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'}) : 'See individual observations below'}</p>
        {availability.source === 'MANUAL OVERRIDE' && <><p>Manual count expires {new Date(z.override!.expires_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}. Reason: {z.override!.reason.replaceAll('_', ' ')}.</p>
          {can('parking.update.manual') && <button className="secondary" disabled={busy} onClick={() => void save('clear_parking_override', {p_zone: z.id}, 'Manual override cleared; current sensor availability restored')}>Clear manual override</button>}</>}
        {z.kind === 'bay' ? <><p>{z.bays.length}/{z.capacity} bays configured. Unreported or stale bays are unknown.</p>
          <div className="parking-bays-grid">{z.bays.map(b => {const d = data.devices.find(d => d.bay_id === b.id); return <div className={`parking-bay parking-bay-${currentBayStatus(b,now).toLowerCase()}`} key={b.id}><h3>{b.label}{b.accessible ? ' · Accessible' : ''}</h3>
            <p>{currentBayStatus(b, now).replaceAll('_', ' ')}{b.simulated ? ' · SIMULATED' : ''}</p>
            <small>{b.observed_at ? new Date(b.observed_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'}) : 'No observation'}</small>
            {d && can('parking.simulate') && <ParkingAction label={`Simulate bay ${b.label}`} busy={busy} submit={f => save('simulate_parking_bay', {p_device: d.id, p_status: f.get('status')}, 'Simulated bay observation saved')}>
              <label>Simulated bay status<select name="status">{['FREE', 'OCCUPIED', 'UNKNOWN', 'OUT_OF_SERVICE'].map(status => <option key={status}>{status}</option>)}</select></label>
              {!d.active && <p>Device is suspended. Enable it in Administration before sending events.</p>}
            </ParkingAction>}
          </div>;})}</div></> : <>
          {device && can('parking.simulate') && <ParkingAction label="Send sensor event" busy={busy} submit={f => save('simulate_parking', {p_device: device.id, p_occupied: Number(f.get('occupied'))}, 'Simulated observation saved')}>
            <label>Simulated occupied count<input name="occupied" type="number" min="0" max={z.capacity} required/></label>
          </ParkingAction>}
          {can('parking.update.manual') && <ParkingAction label="Save manual count" busy={busy} submit={f => save('set_parking_override', {p_zone: z.id, p_occupied: Number(f.get('occupied')), p_seconds: Number(f.get('seconds')), p_reason: f.get('reason')}, 'Manual count saved with expiry and audit')}>
            <label>Manually observed occupied count<input name="occupied" type="number" min="0" max={z.capacity} required/></label>
            <label>Override duration<select name="seconds"><option value="60">1 minute</option><option value="300">5 minutes</option><option value="900">15 minutes</option><option value="3600">1 hour</option></select></label>
            <label>Override reason<select name="reason"><option value="sensor_outage">Sensor outage</option><option value="verified_count">Verified count</option><option value="maintenance">Maintenance</option></select></label>
          </ParkingAction>}
        </>}
      </article>;
    })}</div>{!data.zones.length && <p>No parking zones configured for this site.</p>}
    {can('parking.configure') && <article><h2>Facility and bay setup</h2><p>Create zones and manage device activation in Administration. Attach a new empty zone to a level before creating its bays. Source type is locked once devices or observations exist.</p>
      {data.facilities.map(f => <p key={f.id}>{f.name}{f.details ? ` · ${f.details}` : ''}</p>)}
      <ParkingAction label="Create facility" busy={busy} submit={(f, request) => save('create_parking_structure', {p_site: site, p_id: request, p_type: 'facility', p_parent: null, p_name: f.get('name'), p_details: f.get('details')}, 'Facility created')}>
        <label>Facility name<input name="name" maxLength={80} required/></label><label>Published facility information<input name="details" maxLength={500}/></label>
      </ParkingAction>
      <ParkingAction label="Create level" busy={busy} submit={(f, request) => save('create_parking_structure', {p_site: site, p_id: request, p_type: 'level', p_parent: f.get('facility'), p_name: f.get('name'), p_details: ''}, 'Level created')}>
        <label>Facility<select name="facility" required defaultValue=""><option value="">Choose facility</option>{data.facilities.map(f => <option value={f.id} key={f.id}>{f.name}</option>)}</select></label><label>Level name<input name="name" maxLength={80} required/></label>
      </ParkingAction>
      <ParkingAction label="Configure zone hierarchy" busy={busy} submit={f => save('configure_parking_zone', {p_zone: f.get('zone'), p_level: f.get('level'), p_kind: f.get('kind'), p_expected: data.zones.find(z => z.id === f.get('zone'))?.revision}, 'Zone hierarchy saved')}>
        <label>Zone to configure<select name="zone" required defaultValue=""><option value="">Choose zone</option>{data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
        <label>Parking level<select name="level" required defaultValue=""><option value="">Choose level</option>{data.levels.map(l => <option key={l.id} value={l.id}>{data.facilities.find(f => f.id === l.facility_id)?.name} / {l.name}</option>)}</select></label>
        <label>Observation source<select name="kind"><option value="counter">Aggregate counter</option><option value="bay">Individual bay sensors</option></select></label>
      </ParkingAction>
      <ParkingAction label="Create bay" busy={busy} submit={(f, request) => save('create_parking_bay', {p_zone: f.get('zone'), p_id: request, p_label: f.get('label'), p_accessible: f.get('accessible') === 'on'}, 'Bay created with unknown state')}>
        <label>Bay zone<select name="zone" required defaultValue=""><option value="">Choose bay-sensor zone</option>{data.zones.filter(z => z.kind === 'bay').map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
        <label>Bay label<input name="label" required maxLength={40}/></label><label className="check"><input name="accessible" type="checkbox"/>Accessible bay</label>
      </ParkingAction>
      <ParkingAction label="Register bay device" busy={busy} submit={(f, request) => save('create_bay_device', {p_bay: f.get('bay'), p_id: request}, 'Bay device registered suspended; credentials are provisioned separately')}>
        <label>Device bay<select name="bay" required defaultValue=""><option value="">Choose bay</option>{data.zones.flatMap(z => z.bays.filter(b => !data.devices.some(d => d.bay_id === b.id)).map(b => <option key={b.id} value={b.id}>{z.name} / {b.label}</option>))}</select></label>
      </ParkingAction>
    </article>}
    </>}
  </section>;
}

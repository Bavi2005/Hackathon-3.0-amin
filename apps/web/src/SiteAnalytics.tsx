import {useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {malaysiaDate, visitorDateRange} from '../../../packages/contracts/visitor-records';
type Analytics = {generated_at: string; definitions: string; visitors: {registrations: number; entered: number; departed: number; onsite_in_cohort: number; assisted_registrations: number; average_registration_to_entry_minutes: number | null}; transport: {requests: number; completed: number; cancelled: number; active: number; wait_sample_size: number; average_wait_minutes: number | null}; parking_now: {zones: number; counter_zones: number; bay_zones: number; stale_counter_zones: number; active_manual_overrides: number; bays: number; unknown_or_stale_bays: number; active_devices: number; suspended_devices: number}; daily_visitors: {date: string; registrations: number}[]};
export function SiteAnalytics({db, site}: {db: SupabaseClient; site: string}) {
  const [from, setFrom] = useState(malaysiaDate(Date.now() - 6 * 86400000)), [until, setUntil] = useState(malaysiaDate()), [data, setData] = useState<Analytics | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function load() {
    if (busy) return; const controller = new AbortController(); pending.current = controller; setBusy(true); setError(''); setData(null);
    try {
      const range = visitorDateRange(from, until);
      const {data, error} = await db.rpc('get_site_analytics', {p_site: site, ...range}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return; if (error) throw Error(error.message); setData(data);
    } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Analytics unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  const average = (value: number | null) => value === null ? 'Not enough timestamped records' : `${Number(value).toFixed(2)} minutes`;
  return <section aria-label="Site analytics"><p>Authorized aggregate reporting. No visitor names, phone numbers, invitation tokens or precise driver locations appear here.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <form onSubmit={e => {e.preventDefault(); void load();}}><fieldset disabled={busy}><legend>Reporting window</legend>
      <label>Report from<input type="date" required value={from} onChange={e => {setFrom(e.target.value); setData(null);}}/></label>
      <label>Report through<input type="date" required value={until} onChange={e => {setUntil(e.target.value); setData(null);}}/></label>
      <button disabled={busy}>Load site report</button>
    </fieldset></form>
    {busy && <p role="status">Loading report…</p>}{data && <>
      <p>{data.definitions}</p><p>Generated {new Date(data.generated_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})} (Malaysia time).</p>
      <div className="cards"><article><h2>Visitors</h2><p>{data.visitors.registrations} registrations · {data.visitors.entered} entered · {data.visitors.departed} departed</p><p>{data.visitors.onsite_in_cohort} still on site in this cohort · {data.visitors.assisted_registrations} assisted registrations</p><p>Registration to entry: {average(data.visitors.average_registration_to_entry_minutes)}</p></article>
      <article><h2>Transport</h2><p>{data.transport.requests} requests · {data.transport.completed} completed · {data.transport.cancelled} cancelled · {data.transport.active} active</p><p>Average wait: {average(data.transport.average_wait_minutes)}</p><p>{data.transport.wait_sample_size} timestamped boarded rides in the wait sample.</p></article>
      <article><h2>Parking now</h2><p>{data.parking_now.zones} zones: {data.parking_now.counter_zones} counter / {data.parking_now.bay_zones} bay-sensor zones</p><p>{data.parking_now.stale_counter_zones} stale counter feeds · {data.parking_now.active_manual_overrides} active manual overrides</p><p>{data.parking_now.unknown_or_stale_bays}/{data.parking_now.bays} bays unknown or stale</p><p>{data.parking_now.active_devices} active / {data.parking_now.suspended_devices} suspended devices</p></article></div>
      <h3>Daily visitor registrations</h3>{data.daily_visitors.length ? <ul>{data.daily_visitors.map(d => <li key={d.date}>{d.date}: {d.registrations}</li>)}</ul> : <p>No registrations in this reporting window.</p>}
    </>}
  </section>;
}

import {useCallback, useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Route = {id: string; name: string; stop_names: string[]; start_minute: number; end_minute: number; headway_minutes: number; published: boolean; revision: number};
const minutes = (value: string) => {const [h, m] = value.split(':').map(Number); return h * 60 + m;};
const clock = (value: number) => `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
export function TransportRoutes({db, site, stops, configure}: {db: SupabaseClient; site: string; stops: string[]; configure: boolean}) {
  const [routes, setRoutes] = useState<Route[] | null>(null), [editing, setEditing] = useState<Route | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lifetime = useRef(new AbortController()), request = useRef(crypto.randomUUID());
  const load = useCallback(async() => {
    const {data, error} = await db.from('transport_routes').select('*').eq('site_id', site).order('name').limit(100).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
    if (lifetime.current.signal.aborted) return; if (error) throw Error(error.message); setRoutes(data);
  }, [db, site]);
  useEffect(() => {const controller = new AbortController(); lifetime.current = controller; void load().catch(e => {if (!controller.signal.aborted) setError(e.message);}); return () => controller.abort();}, [load]);
  async function save(form: FormData) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const {error} = await db.rpc('save_transport_route', {p_site: site, p_id: editing?.id ?? request.current, p_expected: editing?.revision ?? 0, p_name: form.get('name'), p_stops: [form.get('from'), form.get('to')], p_start: minutes(String(form.get('start'))), p_end: minutes(String(form.get('end'))), p_headway: Number(form.get('headway')), p_published: form.get('published') === 'on'})
        .abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
      if (lifetime.current.signal.aborted) return; if (error) throw Error(error.message); setMessage('Route timetable saved.'); setEditing(null); await load();
    } catch (failure) {if (!lifetime.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Route unavailable');}
    finally {if (!lifetime.current.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Transport routes"><h2>Configured routes</h2><p>Daily timetables in Malaysia time. These are configured schedules, not live arrival predictions. Fictional routes do not represent a transport partnership.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>Refresh routes</button>
    {routes?.map(r => <article key={r.id}><h3>{r.name}</h3><p>{r.stop_names.join(' → ')}</p><p>{clock(r.start_minute)}–{clock(r.end_minute)} · Every {r.headway_minutes} minutes · {r.published ? 'Published' : 'Draft'}</p>
      {configure && <button className="secondary" disabled={busy} onClick={() => setEditing(r)}>Edit route {r.name}</button>}</article>)}
    {routes?.length === 0 && <p>No fixed route timetable is published for this site. Ride requests still need dispatch confirmation.</p>}
    {configure && <form key={`${editing?.id ?? 'new'}:${editing?.revision}`} onChange={() => {request.current = crypto.randomUUID();}} onSubmit={e => {e.preventDefault(); void save(new FormData(e.currentTarget));}}><fieldset disabled={busy}><legend>{editing ? 'Edit route' : 'Create two-stop route'}</legend>
      <label>Route name<input name="name" required maxLength={80} defaultValue={editing?.name ?? ''}/></label>
      <label>Route origin<select name="from" required defaultValue={editing?.stop_names[0] ?? ''}><option value="">Choose stop</option>{stops.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Route destination<select name="to" required defaultValue={editing?.stop_names[1] ?? ''}><option value="">Choose stop</option>{stops.map(s => <option key={s}>{s}</option>)}</select></label>
      <label>Service starts<input name="start" type="time" required defaultValue={clock(editing?.start_minute ?? 480)}/></label>
      <label>Service ends<input name="end" type="time" required defaultValue={clock(editing?.end_minute ?? 1080)}/></label>
      <label>Scheduled interval in minutes<input name="headway" type="number" min="1" max="180" required defaultValue={editing?.headway_minutes ?? 20}/></label>
      <label className="check"><input name="published" type="checkbox" defaultChecked={editing?.published ?? false}/>Publish timetable to site members</label>
      <button disabled={busy}>Save route timetable</button>{editing && <button type="button" className="secondary" onClick={() => setEditing(null)}>Cancel route edit</button>}
    </fieldset></form>}
  </section>;
}

import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {malaysiaDate, visitorDateRange, visitorRecordsCsv, type VisitorRecordsPage, type VisitorRecordsExport} from '../../../packages/contracts/visitor-records';

export function VisitorRecords({db, site, canExport}: {db: SupabaseClient; site: string; canExport: boolean}) {
  const [start, setStart] = useState(() => malaysiaDate(Date.now() - 6 * 86400000));
  const [end, setEnd] = useState(() => malaysiaDate());
  const [status, setStatus] = useState('all'), [query, setQuery] = useState('');
  const [reason, setReason] = useState(''), [result, setResult] = useState<VisitorRecordsPage | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef<AbortController | null>(null), active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; pending.current?.abort(); };
  }, []);
  function changed() { setResult(null); setMessage(''); setError(''); }
  function filters() { return {p_site: site, ...visitorDateRange(start, end), p_status: status, p_query: query.trim()}; }
  async function request(kind: 'search' | 'export', offset = 0) {
    if (pending.current) return;
    const controller = new AbortController(); pending.current = controller;
    setBusy(true); setError(''); setMessage('');
    if (kind === 'search') setResult(null);
    try {
      const args = filters();
      if (kind === 'export' && !reason) throw Error('Choose an export purpose');
      const {data, error} = await db.rpc(kind === 'search' ? 'search_visitor_records' : 'export_visitor_records', {
        ...args, ...(kind === 'search' ? {p_limit: 25, p_offset: offset} : {p_reason: reason}),
      }).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (!active.current || controller.signal.aborted) return;
      if (error) throw Error(error.message);
      if (kind === 'search') setResult(data as VisitorRecordsPage);
      else {
        const exported = data as VisitorRecordsExport;
        const url = URL.createObjectURL(new Blob([visitorRecordsCsv(exported.records)], {type: 'text/csv;charset=utf-8'}));
        const link = document.createElement('a');
        link.href = url; link.download = `visitor-records-${start}-${end}.csv`;
        document.body.append(link); link.click(); link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage(`Export authorized and audited: ${exported.count} masked records. Download started.`);
      }
    } catch (failure) {
      if (active.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Records unavailable. Retry when connected.');
    } finally {
      pending.current = null;
      if (active.current) setBusy(false);
    }
  }
  function search(event: FormEvent) { event.preventDefault(); void request('search'); }
  const time = (value: string | null) => value ? new Date(value).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'}) : 'Not recorded';
  return <section aria-label="Visitor records" className="visitor-records">
    <h2>Search visitor records</h2>
    <p>Search this site by registration date, status, guest name or visit reference. Results and exports mask guest names. Dates use Malaysia time; select up to 31 days.</p>
    <form onSubmit={search}>
      <fieldset disabled={busy}><legend>Record filters</legend><div className="inline">
        <label>Registered from<input type="date" required value={start} onChange={e => {setStart(e.target.value); changed();}}/></label>
        <label>Registered through<input type="date" required value={end} onChange={e => {setEnd(e.target.value); changed();}}/></label>
        <label>Visit status<select value={status} onChange={e => {setStatus(e.target.value); changed();}}>
          <option value="all">All statuses</option><option value="pending_entry">Pending entry</option><option value="onsite">On site</option><option value="departed">Departed</option>
        </select></label>
        <label>Name or reference<input maxLength={80} value={query} onChange={e => {setQuery(e.target.value); changed();}}/></label>
      </div><button type="submit">Search records</button></fieldset>
    </form>
    {busy && <p role="status">Loading visitor records…</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {message && <p role="status" className="success">{message}</p>}
    {result && <><p>{result.records.length ? `Showing records ${result.offset + 1}–${result.offset + result.records.length}, newest first.` : 'No records match these filters.'}</p>
      <div className="cards">{result.records.map(record => <article key={record.id}>
        <h3>{record.masked_name}</h3><p>{record.status.replaceAll('_', ' ')}</p>
        <small>Reference: {record.id}</small><small>Registered: {time(record.created_at)}</small>
        <small>Entered: {time(record.entered_at)}</small><small>Exited: {time(record.exited_at)}</small>
      </article>)}</div>
      <div className="inline"><button className="secondary" disabled={busy || result.offset === 0} onClick={() => void request('search', Math.max(0, result.offset - 25))}>Previous records</button>
        <button className="secondary" disabled={busy || !result.has_more || result.offset >= 10000} onClick={() => void request('search', result.offset + 25)}>Next records</button></div>
    </>}
    {!result && !busy && !error && <p>Choose filters and search to load records.</p>}
    {canExport && <form onSubmit={event => {event.preventDefault(); void request('export');}}>
      <fieldset disabled={busy}><legend>Restricted export</legend>
        <p>Exports use the current filters, contain at most 1,000 masked records and are recorded in the site audit. Keep downloaded files secure.</p>
        <label>Export purpose<select required value={reason} onChange={e => {setReason(e.target.value); setMessage('');}}>
          <option value="">Choose purpose</option><option value="operations_review">Operations review</option>
          <option value="incident_review">Incident review</option><option value="privacy_request">Privacy request review</option>
        </select></label><button type="submit">Export masked CSV</button>
      </fieldset>
    </form>}
  </section>;
}

import {useCallback, useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Request = {id: string; visit_id: string; requester: string; kind: string; status: string; proposed_name: string | null; decision_reason: string | null; hold_until: string | null; hold_reason: string | null; created_at: string};
export function PrivacyRequests({db, site, user, review, hold}: {db: SupabaseClient; site: string; user: string; review: boolean; hold: boolean}) {
  const [requests, setRequests] = useState<Request[] | null>(null), [kind, setKind] = useState('access'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lifetime = useRef(new AbortController()), requestId = useRef(crypto.randomUUID());
  const rpc = useCallback(async(name: string, args: Record<string, unknown>) => {
    const {data, error} = await db.rpc(name, args).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)])); if (error) throw Error(error.message); return data;
  }, [db]);
  const load = useCallback(async() => {const data = await rpc('list_privacy_requests', {p_site: site}); if (!lifetime.current.signal.aborted) setRequests(data);}, [rpc, site]);
  useEffect(() => {const controller = new AbortController(); lifetime.current = controller; void load().catch(e => {if (!controller.signal.aborted) setError(e.message);}); return () => controller.abort();}, [load]);
  async function run(name: string, args: Record<string, unknown>, success: string, download = false) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const result = await rpc(name, args); if (lifetime.current.signal.aborted) return;
      if (download) {const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], {type: 'application/json'})); const link = document.createElement('a'); link.href = url; link.download = 'authorized-visitor-record.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);}
      setMessage(success); await load();
    } catch (failure) {if (!lifetime.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Privacy request unavailable');}
    finally {if (!lifetime.current.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Visitor privacy requests"><h2>Visitor record requests</h2><p>Open a request for an invitation you own. An independent authorized reviewer must verify the visitor's identity and your authority before approving access, a name correction or record minimization. Use fictional details only. This workflow does not certify legal compliance.</p>
    <p>Approved minimization removes the visitor's name and answers. Minimal references, the host association and operational timestamps remain under the retention policy. On-site records and active legal holds block changes.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>Refresh privacy requests</button>
    <form onChange={() => {requestId.current = crypto.randomUUID();}} onSubmit={e => {e.preventDefault(); const f = new FormData(e.currentTarget); void run('request_visit_privacy', {p_id: requestId.current, p_visit: f.get('visit'), p_kind: kind, p_name: kind === 'correction' ? String(f.get('name')).trim() : null}, 'Privacy request recorded for review.');}}><fieldset disabled={busy}><legend>New request</legend>
      <label>Visitor reference<input name="visit" required pattern="[0-9a-fA-F-]{36}" autoComplete="off"/></label>
      <label>Request type<select value={kind} onChange={e => setKind(e.target.value)}><option value="access">Access copy</option><option value="correction">Correct fictional name</option><option value="erasure">Minimize name and answers</option></select></label>
      {kind === 'correction' && <label>Corrected fictional name<input name="name" required maxLength={80}/></label>}
      <button disabled={busy}>Submit privacy request</button>
    </fieldset></form>
    {hold && <form onSubmit={e => {e.preventDefault(); const f = new FormData(e.currentTarget); void run('set_visitor_hold', {p_visit: f.get('visit'), p_days: Number(f.get('days')), p_reason: f.get('reason'), p_confirm: f.get('confirm') === 'on'}, 'Hold decision saved and audited.');}}><fieldset disabled={busy}><legend>Retention hold</legend>
      <label>Hold visitor reference<input name="visit" required pattern="[0-9a-fA-F-]{36}"/></label><label>Hold days (0 releases the hold)<input name="days" type="number" min="0" max="365" required defaultValue="30"/></label>
      <label>Hold reason<select name="reason"><option value="incident_review">Incident review</option><option value="legal_obligation">Legal obligation</option><option value="dispute">Dispute</option></select></label>
      <label className="check"><input name="confirm" type="checkbox" required/>I confirm the authorized retention decision.</label><button disabled={busy}>Save hold decision</button>
    </fieldset></form>}
    {!requests && !error && <p>Loading privacy requests…</p>}{requests?.length === 0 && <p>No visible privacy requests at this site.</p>}
    {requests?.map(r => <article key={r.id}><h3>{r.kind} · {r.status}</h3><p>Visit {r.visit_id}</p><p>Requested {new Date(r.created_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}</p>
      {r.proposed_name && <p>Proposed fictional name: {r.proposed_name}</p>}{r.decision_reason && <p>Decision: {r.decision_reason.replaceAll('_', ' ')}</p>}
      {r.hold_until && <p>Hold: {r.hold_reason?.replaceAll('_', ' ')} until {new Date(r.hold_until).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}</p>}
      {review && r.requester !== user && r.status === 'requested' && <form onSubmit={e => {e.preventDefault(); const f = new FormData(e.currentTarget); void run('review_privacy_request', {p_id: r.id, p_approve: f.get('decision') === 'verified_authority', p_reason: f.get('decision'), p_identity_checked: f.get('identity') === 'on'}, 'Privacy review recorded.');}}><fieldset disabled={busy}><legend>Independent review</legend>
        <label>Review decision<select name="decision" required defaultValue=""><option value="">Choose decision</option><option value="verified_authority">Approve: identity and authority verified</option><option value="insufficient_authority">Reject: insufficient authority</option><option value="retention_obligation">Reject: retention obligation</option></select></label>
        <label className="check"><input name="identity" type="checkbox" required/>I completed the required identity and authority review.</label><button disabled={busy}>Record privacy review</button>
      </fieldset></form>}
      {review && r.status === 'approved' && <form onSubmit={e => {e.preventDefault(); void run('fulfill_privacy_request', {p_id: r.id, p_confirm: true}, r.kind === 'access' ? 'Authorized record copy downloaded and access audited.' : 'Approved record change completed and audited.', r.kind === 'access');}}><fieldset disabled={busy}><legend>Fulfil approved request</legend>
        <label className="check"><input type="checkbox" required/>I confirm this approved action and the current retention obligations.</label><button disabled={busy}>{r.kind === 'access' ? 'Download approved record' : 'Apply approved record change'}</button>
      </fieldset></form>}
    </article>)}
  </section>;
}

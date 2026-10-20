import {useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Candidate = {id: string; name: string; capacity: number; occupied: number; spare: number; accessible: boolean; eta_minutes: number | null; quality: string; reason: string};
export function DispatchOptions({db, ride, assigned, onSaved}: {db: SupabaseClient; ride: string; assigned: string | null; onSaved: () => Promise<void>}) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reason, setReason] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function run(vehicle?: string) {
    if (busy) return; const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      const name = vehicle ? assigned ? 'reassign_ride' : 'assign_ride' : 'get_dispatch_recommendations';
      const args = vehicle ? {p_ride: ride, p_vehicle: vehicle, ...(assigned ? {p_reason: reason} : {})} : {p_ride: ride};
      const {data, error} = await db.rpc(name, args).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return; if (error) throw Error(error.message);
      if (vehicle) {setCandidates(null); await onSaved();} else setCandidates(data.candidates);
    } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Dispatch unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Dispatch options"><button className="secondary" disabled={busy} onClick={() => void run()}>Review vehicle options</button>
    {error && <p role="alert" className="error">{error}</p>}
    {candidates && <><p>Capacity-only recommendation. Routing ETA is unavailable. Capacity and assignment are checked again when saved.</p>
      {assigned && <label>Reassignment reason<select value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose reason</option><option value="vehicle_offline">Vehicle offline</option><option value="operational_change">Operational change</option><option value="accessibility">Accessibility</option></select></label>}
      {candidates.filter(c => c.id !== assigned).map(c => <article key={c.id}><h4>{c.name}</h4><p>{c.spare} spare seats · {c.accessible ? 'Accessible' : 'Standard'} · {c.reason}</p><p>{c.quality}</p>
        <button disabled={busy || (!!assigned && !reason)} onClick={() => void run(c.id)}>{assigned ? 'Reassign' : 'Assign'} to {c.name}</button></article>)}
      {!candidates.some(c => c.id !== assigned) && <p>No compatible alternative vehicle with spare capacity. Retry when a suitable shift becomes available.</p>}
    </>}
  </section>;
}

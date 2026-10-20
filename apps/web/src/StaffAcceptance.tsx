import {useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
export function StaffAcceptance({db, token}: {db: SupabaseClient; token: string}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function accept() {
    if (busy || saved) return; const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      const {error} = await db.rpc('accept_staff_invitation', {p_token: token}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return; if (error) throw Error(error.message); setSaved(true);
    } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Invitation unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <main className="setup"><h1>Staff invitation</h1><p>Only the intended signed-in account can accept this single-use invitation. Continue only if you expected access from your site administrator.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {saved ? <><p role="status" className="success">Site membership recorded.</p><button onClick={() => {location.hash = ''; location.reload();}}>Open workspace</button></> : <button disabled={busy} onClick={() => void accept()}>Accept staff access</button>}
    <p><a href="#">Return to workspace</a></p>
  </main>;
}

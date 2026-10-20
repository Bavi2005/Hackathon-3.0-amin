import {useCallback, useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import QRCode from 'qrcode';
export function AccountSecurity({db, user}: {db: SupabaseClient; user: string}) {
  const [factors, setFactors] = useState<{id: string; label: string}[]>([]), [selected, setSelected] = useState(''), [qr, setQr] = useState(''), [code, setCode] = useState('');
  const [level, setLevel] = useState('Checking'), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const active = useRef(true);
  const load = useCallback(async() => {
    const [listed, assurance] = await Promise.all([db.auth.mfa.listFactors(), db.auth.mfa.getAuthenticatorAssuranceLevel()]);
    if (!active.current) return;
    if (listed.error) throw listed.error; if (assurance.error) throw assurance.error;
    setFactors(listed.data.totp.map(f => ({id: f.id, label: f.friendly_name ?? 'Authenticator'})));
    setSelected(previous => previous || listed.data.totp[0]?.id || '');
    setLevel(assurance.data.currentLevel === 'aal2' ? 'Multi-factor session verified' : 'Password session; step-up needed for privileged staff changes');
  }, [db]);
  useEffect(() => {active.current = true; void load().catch(e => {if (active.current) setError(e.message);}); return () => {active.current = false;};}, [load]);
  async function run(work: () => Promise<void>, success: string) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {await work(); if (active.current) {setMessage(success); await load();}}
    catch (failure) {if (active.current) setError(failure instanceof Error ? failure.message : 'Account security unavailable');}
    finally {if (active.current) setBusy(false);}
  }
  return <section aria-label="Account security"><h2>Your account</h2><p>Account reference: {user}</p><p>{level}</p>
    <p>Use an authenticator app for privileged access. The setup QR is private; do not share or capture it in demo evidence.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {!qr && <button disabled={busy} onClick={() => void run(async() => {
      const {data, error} = await db.auth.mfa.enroll({factorType: 'totp', friendlyName: `SmartTownship ${new Date().toISOString().slice(0, 19)}`});
      if (error) throw error;
      const image = await QRCode.toDataURL(data.totp.uri, {width: 240, margin: 2});
      if (active.current) {setSelected(data.id); setQr(image); setCode('');}
    }, 'Authenticator setup started. Verify its code to finish.')}>Set up authenticator</button>}
    {qr && <><img src={qr} alt="Private authenticator setup QR" width="240" height="240"/><p>Scan with your authenticator, then enter its current code. Enrollment is incomplete until verification succeeds.</p></>}
    {(qr || factors.length > 0) && <form onSubmit={e => {e.preventDefault(); void run(async() => {
      const {error} = await db.auth.mfa.challengeAndVerify({factorId: selected, code});
      if (error) throw error; if (active.current) {setQr(''); setCode('');}
    }, 'Authenticator verified for this session.');}}><fieldset disabled={busy}><legend>Verify authenticator</legend>
      {!qr && <label>Authenticator<select value={selected} onChange={e => setSelected(e.target.value)} required>{factors.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}</select></label>}
      <label>Authenticator code<input value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" maxLength={6}/></label>
      <button disabled={busy || !selected}>Verify authenticator code</button>
    </fieldset></form>}
    <h3>Other sessions</h3><p>End refresh sessions on other devices. Already issued access tokens can remain valid until their configured expiry; a disabled site membership is separately denied by server authorization.</p>
    <button className="secondary" disabled={busy} onClick={() => void run(async() => {const {error} = await db.auth.signOut({scope: 'others'}); if (error) throw error;}, 'Other refresh sessions ended.')}>Sign out other devices</button>
  </section>;
}

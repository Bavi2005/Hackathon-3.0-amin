import {useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import type {OtpDelivery, VisitorOtp as Challenge} from '../../../packages/contracts/visitor-forms';

export function VisitorOtp({db, token, initial, onChange}: {db: SupabaseClient; token: string; initial?: Challenge | null; onChange: (ready: boolean) => void}) {
  const [challenge, setChallenge] = useState<Challenge | null>(initial ?? null), [code, setCode] = useState(''), [demo, setDemo] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [now, setNow] = useState(Date.now());
  const pending = useRef<AbortController | null>(null), request = useRef<string | null>(null);
  const expired = !!challenge && Date.parse(challenge.expires_at) <= now;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => {clearInterval(timer); pending.current?.abort();}; }, []);
  useEffect(() => { onChange(!busy && (!challenge || (challenge.verified && !expired))); }, [busy, challenge, expired, onChange]);
  async function run(kind: 'request' | 'verify') {
    if (busy) return;
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      if (kind === 'request') {
        // A lost response retries the same request; it cannot send another code unnoticed.
        request.current ??= crypto.randomUUID();
        const {data, error} = await db.rpc('request_visitor_otp', {p_token: token, p_request: request.current}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        if (error) throw Error(error.message);
        const result = data as OtpDelivery;
        if (result.provider !== 'simulator') throw Error('Unsupported OTP provider');
        setChallenge({id: result.id, expires_at: result.expires_at, verified: false, attempts_remaining: 5});
        setDemo(result.demo_code ?? ''); setCode(''); request.current = null;
        if (!result.demo_code) setError('The first response was lost. Wait 60 seconds and request a new demo code.');
      } else if (challenge) {
        const {data, error} = await db.rpc('verify_visitor_otp', {p_token: token, p_challenge: challenge.id, p_code: code}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        if (error) throw Error(error.message);
        if (data.verified !== true) {
          setChallenge({...challenge, attempts_remaining: data.attempts_remaining ?? 0});
          throw Error(data.message ?? 'Verification failed');
        }
        setChallenge({...challenge, verified: true}); setDemo(''); setCode('');
      }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'OTP unavailable'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section aria-label="Optional OTP simulation"><h3>Optional verification demo</h3>
    <p>Simulator only. No SMS is sent and no phone number is collected. This demonstrates a code workflow; it does not verify a phone or identity.</p>
    {error && <p role="alert" className="error">{error}</p>}
    {challenge?.verified && !expired ? <p className="success">Demo code verified. Register before the code expires.</p> : <>
      <button type="button" className="secondary" disabled={busy} onClick={() => void run('request')}>{challenge ? 'Request new demo code' : 'Try OTP simulator'}</button>
      {demo && <p>Simulated inbox code: <strong data-testid="demo-otp">{demo}</strong></p>}
      {challenge && !expired && <><label>Verification code<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value)}/></label>
        <button type="button" disabled={busy || !/^\d{6}$/.test(code) || challenge.attempts_remaining === 0} onClick={() => void run('verify')}>Verify demo code</button>
        <p>{challenge.attempts_remaining} attempts remaining.</p></>}
    </>}
    {challenge && <p>Code expires {new Date(challenge.expires_at).toLocaleTimeString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})} (Malaysia time).{expired ? ' Expired; request a new code or see the guard.' : ''}</p>}
  </section>;
}

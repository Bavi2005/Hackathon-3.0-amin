import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {collectVisitorAnswers, parseVisitorFields, type VisitorInvitation} from '../../../packages/contracts/visitor-forms';
import {VisitorFields} from './VisitorFields';
import {VisitorOtp} from './VisitorOtp';

export function GuestRegistration({db, token, intent = 'visitor'}: {db: SupabaseClient; token: string; intent?: 'visitor' | 'loading'}) {
  const [invitation, setInvitation] = useState<VisitorInvitation | null>(null), [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [reference, setReference] = useState('');
  const pending = useRef<AbortController | null>(null);
  const [otpReady, setOtpReady] = useState(true);
  const [confirmation, setConfirmation] = useState<{reference: string; status: string; site_name: string; expires_at: string} | null>(null);
  useEffect(() => {
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(''); setInvitation(null); setConfirmation(null);
    void (async () => {
      try {
        const {data, error} = await db.rpc('resolve_visitor_invitation', {p_token: token}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        if (error) {
          if (error.message === 'Invitation unavailable') {
            const confirmed = await db.rpc('get_visitor_confirmation', {p_token: token}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
            if (controller.signal.aborted) return;
            if (!confirmed.error && confirmed.data?.reference) {setConfirmation(confirmed.data); return;}
          }
          throw Error(error.message);
        }
        const value = data as VisitorInvitation;
        if (value.notice_version !== 'demo-notice-v1') throw Error('This registration notice is unavailable. Contact the site desk.');
        if (value.form) parseVisitorFields(value.form.fields);
        setInvitation(value);
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Invitation unavailable. Retry when connected.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => { controller.abort(); pending.current?.abort(); };
  }, [db, token, retry]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!invitation || busy || reference || !otpReady) return;
    const form = new FormData(event.currentTarget), controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      const answers = collectVisitorAnswers(invitation.form?.fields ?? [], form);
      const {data, error} = await db.rpc('submit_visitor_registration', {p_token: token, p_name: String(form.get('name')).trim(), p_consent: form.get('consent') === 'on', p_answers: answers})
        .abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return;
      if (error) throw Error(error.message);
      setReference(String(data));
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Registration failed. Retry when connected.'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <main className="setup"><span className="eyebrow">MYVISITOR / GUEST REGISTRATION</span><h1>{intent==='loading'?'Delivery & loading registration':"You're invited."}</h1>
    <p>Use fictional details only in this prototype. An invitation does not prove identity; security staff verify entry separately.</p>{intent==='loading'&&<p className="delivery-guest-note">Goods delivery: choose <strong>Delivery</strong> as your purpose, submit the form, then show the confirmation reference at the loading desk. Staff check in your vehicle separately; this QR does not reserve a bay.</p>}
    {loading && <p role="status">Loading your invitation…</p>}
    {error && <p role="alert" className="error">{error}</p>}
    {!loading && !invitation && !confirmation && <button onClick={() => setRetry(value => value + 1)}>Retry invitation</button>}
    {confirmation && <><h2>{confirmation.site_name}</h2><p role="status" className="success">Registration recorded. Current status: {confirmation.status.replaceAll('_', ' ')}.</p><p>Registration reference: {confirmation.reference}</p><p>This private confirmation expires {new Date(confirmation.expires_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}. Entry still requires staff verification.</p><button onClick={() => setRetry(value => value + 1)}>Refresh confirmation</button></>}
    {invitation && <><h2>{invitation.site_name}</h2>{invitation.form && <p>{invitation.form.title} · Form version {invitation.form.version}</p>}
      <p>Expires {new Date(invitation.expires_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})} (Malaysia time).</p>
      {reference && <><p role="status" className="success">Registration recorded. Please see the guard for verification.</p><p>Registration reference: {reference}</p></>}
      <form onSubmit={event => void submit(event)}><fieldset disabled={busy || !!reference}>
        <legend>Visitor details</legend><label>Guest name<input name="name" required maxLength={80} autoComplete="off"/></label>
        <VisitorFields fields={invitation.form?.fields ?? []} defaultPurpose={intent==='loading'?'Delivery':undefined}/>
        {invitation.otp_provider === 'simulator' && <VisitorOtp db={db} token={token} initial={invitation.otp} onChange={setOtpReady}/>}
        {invitation.otp_provider === 'unavailable' && <p>Optional phone verification is unavailable. The guard checks entry separately.</p>}
        <label className="check"><input type="checkbox" name="consent" required/>I acknowledge the demo notice: fictional name and answers are retained for 30 days, then anonymized or cleared. No real personal data.</label>
        <button disabled={busy || !!reference || !otpReady}>Register visit</button>
      </fieldset></form></>}
    <p>Expired or already used invitations cannot be reused.</p>
  </main>;
}

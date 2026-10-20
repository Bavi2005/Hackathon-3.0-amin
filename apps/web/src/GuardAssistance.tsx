import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {collectVisitorAnswers, parseVisitorFields, type VisitorInvitation} from '../../../packages/contracts/visitor-forms';
import {VisitorFields} from './VisitorFields';

export function GuardAssistance({db, site, onSaved}: {db: SupabaseClient; site: string; onSaved: () => Promise<void>}) {
  const [token, setToken] = useState(''), [invitation, setInvitation] = useState<VisitorInvitation | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [reference, setReference] = useState('');
  const pending = useRef<AbortController | null>(null), request = useRef<string | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function run(event: FormEvent<HTMLFormElement>, resolve: boolean) {
    event.preventDefault(); if (busy) return;
    const data = new FormData(event.currentTarget), controller = new AbortController(); pending.current = controller;
    setBusy(true); setError('');
    try {
      if (!/^[a-f0-9]{64}$/.test(token)) throw Error('Enter the 64-character invitation token supplied by the host.');
      if (resolve) {
        const {data, error} = await db.rpc('resolve_assisted_invitation', {p_site: site, p_token: token}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        if (error) throw Error(error.message);
        if (data.notice_version !== 'demo-notice-v1') throw Error('Registration notice unavailable');
        if (data.form) parseVisitorFields(data.form.fields);
        setInvitation(data); setReference(''); request.current = null;
      } else if (invitation) {
        const answers = collectVisitorAnswers(invitation.form?.fields ?? [], data); request.current ??= crypto.randomUUID();
        const {data: ident, error} = await db.rpc('register_assisted_visitor', {p_site: site, p_request: request.current, p_token: token,
          p_name: String(data.get('name')).trim(), p_consent: data.get('consent') === 'on', p_answers: answers,
          p_reason: data.get('reason'), p_policy_checked: data.get('policy') === 'on'}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        if (error) throw Error(error.message);
        setReference(String(ident)); await onSaved();
      }
    } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Assistance unavailable'); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  }
  return <section aria-label="Guard-assisted registration"><h2>Help a visitor register</h2>
    <p>Use the host's valid invitation and fictional details. Read the notice to the visitor and follow local entry policy. Assistance is audited and does not claim phone or identity verification. Check-in remains a separate action.</p>
    {error && <p role="alert" className="error">{error}</p>}
    <form onSubmit={e => void run(e, true)}><label>Invitation token<input disabled={busy} value={token} maxLength={64} required autoComplete="off" onChange={e => {setToken(e.target.value.trim()); setInvitation(null); setReference('');}}/></label>
      <button disabled={busy}>Load invitation for assistance</button></form>
    {invitation && <form onSubmit={e => void run(e, false)} onChange={() => {request.current = null;}}><fieldset disabled={busy || !!reference}>
      <legend>{invitation.site_name} · {invitation.form ? `Form version ${invitation.form.version}` : 'Name-only registration'}</legend>
      <label>Assisted guest name<input name="name" required maxLength={80} autoComplete="off"/></label>
      <VisitorFields fields={invitation.form?.fields ?? []}/>
      <label>Assistance reason<select name="reason" required defaultValue=""><option value="">Select reason</option><option value="no_smartphone">No smartphone</option><option value="weak_signal">Weak mobile signal</option><option value="accessibility">Accessibility assistance</option></select></label>
      <label className="check"><input name="consent" type="checkbox" required/>I read the demo notice and the visitor acknowledged that fictional name and answers are retained for 30 days, then anonymized or cleared.</label>
      <label className="check"><input name="policy" type="checkbox" required/>I completed the local entry policy check. This assisted fallback does not verify a phone.</label>
      <button disabled={busy || !!reference}>Record assisted registration</button>
    </fieldset></form>}
    {reference && <p role="status" className="success">Assisted registration recorded: {reference}. Verify entry using the visitor queue.</p>}
  </section>;
}

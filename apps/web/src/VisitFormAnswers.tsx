import {useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseVisitorFields, visitorFieldCatalog, type VisitFormResponse} from '../../../packages/contracts/visitor-forms';

export function VisitFormAnswers({db, visit}: {db: SupabaseClient; visit: string}) {
  const [response, setResponse] = useState<VisitFormResponse | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function show() {
    const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      const {data, error} = await db.rpc('get_visit_form_response', {p_visit: visit}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return;
      if (error) throw Error(error.message);
      const value = data as VisitFormResponse;
      if (value.form) parseVisitorFields(value.form.fields);
      setResponse(value);
    } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Answers unavailable. Retry when connected.');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <div className="visit-answers">
    <button className="secondary" disabled={busy} onClick={() => response ? setResponse(null) : void show()}>{response ? 'Hide submitted form' : 'Show submitted form'}</button>
    {busy && <p role="status">Loading submitted form…</p>}{error && <p role="alert" className="error">{error}</p>}
    {response && <><p>{response.form ? `${response.form.title} · Submitted form version ${response.form.version}` : 'Name-only registration; no additional form fields.'}</p>
      {response.anonymized_at ? <p>Answers cleared under the retention policy.</p> : response.form?.fields.map(field => <p key={field.key}><strong>{visitorFieldCatalog[field.key].label}: </strong>
        {Object.hasOwn(response.answers, field.key) ? typeof response.answers[field.key] === 'boolean' ? response.answers[field.key] ? 'Yes' : 'No' : String(response.answers[field.key]) : 'Not provided'}
      </p>)}
      <small>{response.acknowledged_at ? `Notice acknowledged: ${new Date(response.acknowledged_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}` : 'Historical notice recorded in the registration audit.'}</small>
    </>}
  </div>;
}

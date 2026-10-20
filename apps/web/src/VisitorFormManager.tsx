import {useEffect, useRef, useState, type FormEvent} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {parseVisitorFields, visitorFieldCatalog, visitorTemplates, type VisitorField, type VisitorFieldKey, type VisitorTemplate, type SiteVisitorForms, type VisitorFormVersion} from '../../../packages/contracts/visitor-forms';
import {VisitorFields} from './VisitorFields';

export function VisitorFormManager({db, site}: {db: SupabaseClient; site: string}) {
  const [saved, setSaved] = useState<SiteVisitorForms | null>(null), [reload, setReload] = useState(0);
  const [title, setTitle] = useState('Visitor registration'), [template, setTemplate] = useState<VisitorTemplate>('residential');
  const [fields, setFields] = useState<VisitorField[]>(visitorTemplates.residential);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [message, setMessage] = useState('');
  const active = useRef(true), pending = useRef<AbortController | null>(null), requestId = useRef<string | null>(null);
  function edit() { requestId.current = null; setMessage(''); setError(''); }
  function draft(version: VisitorFormVersion) { setTitle(version.title); setTemplate(version.template); setFields(parseVisitorFields(version.fields)); edit(); }
  useEffect(() => {
    active.current = true;
    const controller = new AbortController(); pending.current = controller; setLoading(true); setError('');
    void (async () => {
      try {
        const {data, error} = await db.rpc('get_site_visitor_forms', {p_site: site}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        if (error) throw Error(error.message);
        const value = data as SiteVisitorForms;
        for (const version of value.history) parseVisitorFields(version.fields);
        if (value.active) {setTitle(value.active.title); setTemplate(value.active.template); setFields(parseVisitorFields(value.active.fields));}
        setSaved(value); requestId.current = null;
      } catch (failure) { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Forms unavailable. Retry when connected.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => {active.current = false; controller.abort(); pending.current?.abort();};
  }, [db, site, reload]);
  function toggle(key: VisitorFieldKey, enabled: boolean) {
    setFields(previous => enabled ? [...previous, {key, required: false}] : previous.filter(field => field.key !== key));
    setTemplate('custom'); edit();
  }
  async function publish(event: FormEvent) {
    event.preventDefault(); if (busy || !saved) return;
    setBusy(true); setError(''); setMessage('');
    const controller = new AbortController(); pending.current = controller;
    try {
      requestId.current ??= crypto.randomUUID();
      const {data, error} = await db.rpc('publish_visitor_form', {p_site: site, p_request: requestId.current, p_expected: saved.active?.id ?? null,
        p_title: title.trim(), p_template: template, p_fields: parseVisitorFields(fields)})
        .abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted || !active.current) return;
      if (error) throw Error(error.message);
      const version = data as VisitorFormVersion;
      // Reload authority from the server: an idempotent retry may return a version superseded elsewhere.
      const current = await db.rpc('get_site_visitor_forms', {p_site: site}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted || !active.current) return;
      if (current.error) {setMessage(`Version ${version.version} was published. Reload to check the active version.`); throw Error(current.error.message);}
      const value = current.data as SiteVisitorForms;
      setSaved(value); requestId.current = null;
      if (value.active) draft(value.active);
      setMessage(`Version ${version.version} published. Active version: ${value.active?.version ?? 'none'}. Existing invitations keep their original form.`);
    } catch (failure) { if (active.current && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Publish failed. Retry when connected.'); }
    finally {if (active.current && !controller.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Visitor form management">
    <h2>Visitor form builder</h2><p>Publish a version for new invitations at this site. Earlier invitations and submitted answers keep their original version.</p>
    <p>Fictional data only. Phone, vehicle plate, identity-document and arbitrary custom fields are unavailable pending a reviewed collection policy.</p>
    {loading && <p role="status">Loading site forms…</p>}{error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={loading || busy} onClick={() => {setMessage(''); setReload(value => value + 1);}}>Reload saved form</button>
    {saved && <><p>{saved.active ? `Active version ${saved.active.version}: ${saved.active.title}` : 'No custom form published. New invitations currently ask for a name and notice acknowledgement.'}</p>
      <form onSubmit={event => void publish(event)}><fieldset disabled={loading || busy}><legend>Form configuration</legend>
        <label>Form title<input required maxLength={80} value={title} onChange={event => {setTitle(event.target.value); edit();}}/></label>
        <label>Form template<select value={template} onChange={event => {const selected = event.target.value as VisitorTemplate; setTemplate(selected); setFields(visitorTemplates[selected].map(field => ({...field}))); edit();}}>
          {Object.keys(visitorTemplates).map(name => <option key={name} value={name}>{name.charAt(0).toUpperCase() + name.slice(1)}</option>)}
        </select></label>
        {(Object.keys(visitorFieldCatalog) as VisitorFieldKey[]).map(key => {
          const selected = fields.find(field => field.key === key), info = visitorFieldCatalog[key];
          return <div className="form-field-choice" key={key}>
            <label className="check"><input type="checkbox" checked={!!selected} onChange={event => toggle(key, event.target.checked)}/>Include {info.label}</label>
            {selected && <label className="check"><input type="checkbox" checked={selected.required} onChange={event => {setFields(previous => previous.map(field => field.key === key ? {...field, required: event.target.checked} : field)); setTemplate('custom'); edit();}}/>Require {info.label}</label>}
          </div>;
        })}
        <button type="submit">Publish form version</button>
      </fieldset></form>
      <article><h3>Draft preview</h3><p>Guest name and the notice acknowledgement are always required.</p><VisitorFields key={JSON.stringify(fields)} fields={fields} disabled/></article>
      <h3>Published versions</h3><p>Latest 20 versions. Reusing a version creates a draft; publishing always adds a new immutable version.</p>
      <div className="cards">{saved.history.map(version => <article key={version.id}><h3>Version {version.version}: {version.title}</h3>
        <p>{new Date(version.created_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}</p>
        <button className="secondary" disabled={loading || busy} onClick={() => draft(version)}>Use version {version.version} as draft</button>
      </article>)}</div>
    </>}
  </section>;
}

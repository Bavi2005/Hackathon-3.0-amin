import {useCallback, useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
type Overview = {tenants: {id: string; name: string; demo: boolean; sites: number; active_memberships: number}[]; simulation_enabled: boolean; integrations: Record<string, string>; audit: {action: string; record_id: string; created_at: string}[]};
export function PlatformAdministration({db}: {db: SupabaseClient}) {
  const [data, setData] = useState<Overview | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lifetime = useRef(new AbortController()), request = useRef(crypto.randomUUID());
  const load = useCallback(async() => {const {data, error} = await db.rpc('get_platform_overview').abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)])); if (lifetime.current.signal.aborted) return; if (error) throw Error(error.message); setData(data);}, [db]);
  useEffect(() => {const controller = new AbortController(); lifetime.current = controller; void load().catch(e => {if (!controller.signal.aborted) setError(e.message);}); return () => controller.abort();}, [load]);
  async function create(form: FormData) {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {
      const {error} = await db.rpc('create_platform_tenant', {p_id: request.current, p_name: form.get('name'), p_site_name: form.get('site'), p_admin: form.get('admin')}).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
      if (lifetime.current.signal.aborted) return; if (error) throw Error(error.message); setMessage('Tenant, initial site and explicit administrator assignment recorded.'); await load();
    } catch (failure) {if (!lifetime.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Tenant setup unavailable');}
    finally {if (!lifetime.current.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Platform administration"><p>This separately granted platform view contains tenant configuration and counts. It gives no default access to private visitor records or GPS. Do not enter real organization or account information in this prototype.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={busy} onClick={() => void load().catch(e => setError(e.message))}>Refresh platform</button>
    {data && <><p>Deployment simulation: {data.simulation_enabled ? 'Enabled for development' : 'Disabled'}</p><ul>{Object.entries(data.integrations).map(([name, status]) => <li key={name}>{name}: {status}</li>)}</ul>
      <div className="cards">{data.tenants.map(t => <article key={t.id}><h2>{t.name}</h2><p>{t.demo ? 'Fictional demo tenant' : 'Tenant'} · {t.sites} sites · {t.active_memberships} active site memberships</p></article>)}</div>
      <form onChange={() => {request.current = crypto.randomUUID();}} onSubmit={e => {e.preventDefault(); void create(new FormData(e.currentTarget));}}><fieldset disabled={busy}><legend>Create tenant</legend>
        <label>Tenant name<input name="name" required maxLength={100}/></label><label>Initial site name<input name="site" required maxLength={100}/></label><label>Initial administrator account reference<input name="admin" required pattern="[0-9a-fA-F-]{36}"/></label>
        <label className="check"><input type="checkbox" required/>I confirm the new tenant and this explicit administrator assignment.</label><button disabled={busy}>Create tenant and site</button>
      </fieldset></form><h3>Platform change audit</h3>{data.audit.map((a, index) => <p key={`${a.record_id}:${index}`}>{a.action} · {a.record_id} · {new Date(a.created_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}</p>)}</>}
  </section>;
}
export function TownshipSiteCreator({db, tenant}: {db: SupabaseClient; tenant: string}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [error, setError] = useState('');
  const request = useRef(crypto.randomUUID()), pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  return <form aria-label="Township site creation" onChange={() => {request.current = crypto.randomUUID();}} onSubmit={async e => {
    e.preventDefault(); if (busy) return; const f = new FormData(e.currentTarget), controller = new AbortController(); pending.current = controller; setBusy(true); setMessage(''); setError('');
    try {const {error} = await db.rpc('create_township_site', {p_tenant: tenant, p_id: request.current, p_name: f.get('name')}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)])); if (controller.signal.aborted) return; if (error) throw Error(error.message); setMessage('Site created with your authorized township administration grant. Reload the workspace to select it.');}
    catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Site setup unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }}><fieldset disabled={busy}><legend>Create township site</legend>{error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <label>New site name<input name="name" required maxLength={100}/></label><label className="check"><input type="checkbox" required/>I confirm this site belongs to my assigned township.</label><button disabled={busy}>Create township site</button>
  </fieldset></form>;
}

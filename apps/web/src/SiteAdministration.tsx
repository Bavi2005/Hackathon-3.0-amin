import {useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import {memberTemplate, staffTemplates, type SiteAdministrationData, type ManagedVehicle, type ManagedZone, type ManagedDevice} from '../../../packages/contracts/administration';

function Editor({title, children, submit, busy}: {title: string; children: ReactNode; submit: (data: FormData, request: string) => Promise<void>; busy: boolean}) {
  const request = useRef(crypto.randomUUID());
  return <form aria-label={title} onChange={() => {request.current = crypto.randomUUID();}} onSubmit={event => {event.preventDefault(); void submit(new FormData(event.currentTarget), request.current);}}><fieldset disabled={busy}><legend>{title}</legend>{children}<button disabled={busy}>Save {title.toLowerCase()}</button></fieldset></form>;
}
function TemplateSelect({value}: {value?: string}) {
  return <label>Staff assignment<select name="template" defaultValue={value ?? 'guard'}>{staffTemplates.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>;
}
export function SiteAdministration({db, site, user, capabilities}: {db: SupabaseClient; site: string; user: string; capabilities: string[]}) {
  const [data, setData] = useState<SiteAdministrationData | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [link, setLink] = useState('');
  const [vehicle, setVehicle] = useState<ManagedVehicle | null>(null), [zone, setZone] = useState<ManagedZone | null>(null), [device, setDevice] = useState<ManagedDevice | null>(null);
  const lifetime = useRef(new AbortController()), inviteRequest = useRef<string | null>(null);
  const can = (cap: string) => capabilities.includes(cap);
  const rpc = useCallback(async(name: string, args: Record<string, unknown>) => {
    const {data, error} = await db.rpc(name, args).abortSignal(AbortSignal.any([lifetime.current.signal, AbortSignal.timeout(15000)]));
    if (error) throw Error(error.message); return data;
  }, [db]);
  const load = useCallback(async() => {
    const value: SiteAdministrationData = await rpc('get_site_administration', {p_site: site});
    if (!lifetime.current.signal.aborted) {
      setData(value); setVehicle(v => v ? value.vehicles.find(row => row.id === v.id) ?? null : null);
      setZone(z => z ? value.zones.find(row => row.id === z.id) ?? null : null);
      setDevice(d => d ? value.devices.find(row => row.id === d.id) ?? null : null);
    }
  }, [rpc, site]);
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    void load().catch(e => {if (!controller.signal.aborted) setError(e.message);});
    return () => controller.abort();
  }, [load]);
  async function save(work: () => Promise<unknown>, success = 'Changes saved and audited') {
    if (busy) return; setBusy(true); setError(''); setMessage('');
    try {await work(); if (!lifetime.current.signal.aborted) {setMessage(success); await load();}}
    catch (failure) {if (!lifetime.current.signal.aborted) setError(failure instanceof Error ? failure.message : 'Unable to save');}
    finally {if (!lifetime.current.signal.aborted) setBusy(false);}
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const fields = new FormData(event.currentTarget);
    await save(async() => {
      inviteRequest.current ??= crypto.randomUUID();
      const result = await rpc('invite_site_staff', {p_site: site, p_request: inviteRequest.current, p_user: fields.get('account'), p_template: fields.get('template')});
      if (lifetime.current.signal.aborted) return;
      if (result.token) setLink(`${location.origin}${location.pathname}#staff=${result.token}`);
      else throw Error('Invitation already issued. Revoke it and issue a new invitation if the first link was lost.');
      inviteRequest.current = null;
    }, 'Staff invitation created. Share the private link with the intended account holder.');
  }
  const common = {p_site: site};
  return <section aria-label="Site administration"><p>Manage this site's delegated staff and service assets. Use fictional data in this prototype. Staff changes require a verified MFA session outside the development simulator.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button className="secondary" disabled={busy} onClick={() => void save(load, 'Administration refreshed')}>Reload administration</button>
    {!data && !error && <p>Loading site configuration…</p>}
    {data && <>
      {can('staff.invite') && <article><h2>Invite staff</h2><p>The recipient needs an existing account with their own password. Get their account reference directly from them. No email is sent and no cross-site account search is available.</p>
        <form onSubmit={e => void invite(e)} onChange={() => {inviteRequest.current = null; setLink('');}}><fieldset disabled={busy}><legend>Staff invitation</legend>
          <label>Recipient account reference<input name="account" required pattern="[0-9a-fA-F-]{36}" autoComplete="off"/></label><TemplateSelect/>
          <label className="check"><input type="checkbox" required/>I confirm this account should receive the selected staff access at this site.</label>
          <button disabled={busy}>Create staff invitation</button>
        </fieldset></form>{link && <p><a href={link}>Private staff invitation</a> · Expires in 24 hours. Only the intended account can accept.</p>}
        {data.invitations.map(i => <article key={i.id}><p>{i.template} · Account {i.target_user}</p><p>{i.accepted_at ? 'Accepted' : i.revoked_at ? 'Revoked' : `Expires ${new Date(i.expires_at).toLocaleString('en-MY', {timeZone: 'Asia/Kuala_Lumpur'})}`}</p>
          {!i.accepted_at && !i.revoked_at && <button className="secondary" disabled={busy} onClick={() => void save(() => rpc('revoke_staff_invitation', {...common, p_id: i.id}), 'Invitation revoked')}>Revoke invitation</button>}</article>)}
      </article>}
      {can('staff.manage') && <article><h2>Site memberships</h2><p>Account reference for your profile: {user}. Administrative memberships are provisioned separately.</p>
        {data.members.map(m => <article key={`${m.id}:${m.revision}`}><h3>{m.role.replaceAll('_', ' ')}</h3><p>Account {m.user_id} · {m.active ? 'Active' : 'Disabled'} · Revision {m.revision}</p>
          {m.user_id !== user && ['STAFF', 'DRIVER', 'LOADER'].includes(m.role) && <Editor title="Staff membership" busy={busy} submit={f => save(() => rpc('set_staff_membership', {...common, p_id: m.id, p_expected: m.revision, p_template: f.get('template'), p_active: f.get('active') === 'on'}))}>
            <TemplateSelect value={memberTemplate(m)}/><label className="check"><input name="active" type="checkbox" defaultChecked={m.active}/>Site access enabled</label>
            <label className="check"><input type="checkbox" required/>I confirm this staff access change.</label>
          </Editor>}</article>)}
      </article>}
      {can('fleet.configure') && <article><h2>Fleet configuration</h2><p>Vehicles can be edited only when off shift and without active rides. This configuration does not connect a real transport service.</p>
        {data.vehicles.map(v => <p key={v.id}>{v.name} · {v.capacity} seats · {v.shift_active ? 'On shift' : 'Off shift'} <button className="secondary" disabled={busy || v.shift_active} onClick={() => setVehicle(v)}>Edit {v.name}</button></p>)}
        <button className="secondary" onClick={() => setVehicle(null)}>New vehicle</button>
        <Editor key={`vehicle:${vehicle?.id ?? 'new'}:${vehicle?.revision}`} title="Vehicle" busy={busy} submit={(f, request) => save(() => rpc('save_site_vehicle', {...common, p_id: vehicle?.id ?? request, p_expected: vehicle?.revision ?? 0, p_name: f.get('name'), p_capacity: Number(f.get('capacity')), p_accessible: f.get('accessible') === 'on', p_driver: String(f.get('driver')).trim() || null}))}>
          <label>Vehicle name<input name="name" required maxLength={80} defaultValue={vehicle?.name ?? ''}/></label>
          <label>Passenger capacity<input name="capacity" type="number" min="1" max="100" required defaultValue={vehicle?.capacity ?? 1}/></label>
          <label>Assigned driver account reference<input name="driver" pattern="[0-9a-fA-F-]{36}" defaultValue={vehicle?.driver_id ?? ''}/></label>
          <label className="check"><input name="accessible" type="checkbox" defaultChecked={vehicle?.accessible ?? false}/>Accessible vehicle</label>
        </Editor>
        <h3>Allowed pickup and destination stops</h3><ul>{data.stops.map(s => <li key={s.id}>{s.name}</li>)}</ul>
        <Editor title="Stop" busy={busy} submit={f => save(() => rpc('add_site_stop', {...common, p_name: f.get('name')}))}><label>Stop name<input name="name" required maxLength={100}/></label></Editor>
      </article>}
      {can('parking.configure') && <article><h2>Parking configuration</h2><p>These zones report aggregate counter estimates. Registering a device does not create credentials or connect hardware. Suspended devices cannot ingest events.</p>
        {data.zones.map(z => <p key={z.id}>{z.name} · Capacity {z.capacity} <button className="secondary" onClick={() => setZone(z)}>Edit {z.name}</button></p>)}
        <button className="secondary" onClick={() => setZone(null)}>New parking zone</button>
        <Editor key={`zone:${zone?.id ?? 'new'}:${zone?.revision}`} title="Parking zone" busy={busy} submit={(f, request) => save(() => rpc('save_parking_zone', {...common, p_id: zone?.id ?? request, p_expected: zone?.revision ?? 0, p_name: f.get('name'), p_capacity: Number(f.get('capacity'))}))}>
          <label>Zone name<input name="name" required maxLength={100} defaultValue={zone?.name ?? ''}/></label>
          <label>Parking capacity<input name="capacity" type="number" min="1" max="100000" required defaultValue={zone?.capacity ?? 1}/></label>
        </Editor>
        {data.devices.map(d => <p key={d.id}>Device {d.id} · {d.active ? 'Active' : 'Suspended'} · Last sequence {d.last_sequence} <button className="secondary" onClick={() => setDevice(d)}>Edit device {d.id.slice(0, 8)}</button></p>)}
        <button className="secondary" onClick={() => setDevice(null)}>New device</button>
        <Editor key={`device:${device?.id ?? 'new'}:${device?.revision}`} title="Parking device" busy={busy} submit={(f, request) => save(() => rpc('save_parking_device', {...common, p_id: device?.id ?? request, p_expected: device?.revision ?? 0, p_zone: f.get('zone'), p_active: f.get('active') === 'on'}))}>
          <label>Device zone<select name="zone" required defaultValue={device?.zone_id ?? ''}><option value="">Choose zone</option>{data.zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}</select></label>
          <label className="check"><input name="active" type="checkbox" defaultChecked={device?.active ?? false}/>Enable device ingestion</label>
        </Editor>
      </article>}
    </>}
  </section>;
}

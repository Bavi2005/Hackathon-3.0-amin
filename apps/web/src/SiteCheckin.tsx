import {useEffect, useRef, useState} from 'react';
import type {SupabaseClient} from '@supabase/supabase-js';
import QRCode from 'qrcode';
export function PublicCheckin({db, token}: {db: SupabaseClient; token: string}) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const request = useRef(crypto.randomUUID()), pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function start() {
    if (busy) return; const controller = new AbortController(); pending.current = controller; setBusy(true); setError('');
    try {
      const {data, error} = await db.rpc('begin_site_checkin', {p_token: token, p_request: request.current}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return; if (error) throw Error(error.message); location.hash = `invite=${data.token}`;
    } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Site check-in unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <main className="setup"><h1>Site visitor check-in</h1><p>Start a private, single-use registration from the site's displayed QR. No account is required. Use fictional details in this prototype; security staff verify entry separately.</p>
    {error && <p role="alert" className="error">{error}</p>}<button disabled={busy} onClick={() => void start()}>Start visitor registration</button><p>If the link is expired or mobile service is unavailable, ask the guard for assistance.</p>
  </main>;
}
export function SiteCheckinIssuer({db, site}: {db: SupabaseClient; site: string}) {
  const [link, setLink] = useState(''), [qr, setQr] = useState(''), [id, setId] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function change(revoke: boolean) {
    if (busy) return; const controller = new AbortController(); pending.current = controller; setBusy(true); setError(''); setMessage('');
    try {
      const {data, error} = await db.rpc(revoke ? 'revoke_site_checkin_link' : 'create_site_checkin_link', {p_site: site, ...(revoke ? {p_id: id} : {})}).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
      if (controller.signal.aborted) return; if (error) throw Error(error.message);
      if (revoke) {setLink(''); setQr(''); setId(''); setMessage('Site check-in link revoked. Previously started private flows retain their original expiry.');}
      else {
        const value = `${location.origin}${location.pathname}#checkin=${data.token}`, image = await QRCode.toDataURL(value, {width: 240, margin: 2});
        if (controller.signal.aborted) return; setLink(value); setQr(image); setId(data.id); setMessage('Site QR issued for 24 hours. Previous site QR links are revoked; existing private flows keep their expiry.');
      }
    } catch (failure) {if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Site QR unavailable');}
    finally {if (!controller.signal.aborted) setBusy(false);}
  }
  return <section aria-label="Public site check-in QR"><h2>Displayed site QR</h2><p>Each visitor gets a separate private flow using the current published form. Rotate the displayed QR when required; it expires after 24 hours. Do not display a resident's private invitation as a public QR.</p>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    <button disabled={busy} onClick={() => void change(false)}>Issue or rotate site QR</button>
    {link && <><img src={qr} alt="Displayed site check-in QR" width="240" height="240"/><p><a href={link}>Open public site check-in</a></p><button className="secondary" disabled={busy} onClick={() => void change(true)}>Revoke site QR</button></>}
  </section>;
}

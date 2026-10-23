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
  async function copyLink() {
    if (!link) return;
    try {await navigator.clipboard.writeText(link);setMessage('Walk-in check-in link copied. Share only on the intended site signage.');}
    catch {setError('Copy failed. Open the link and copy it from the browser address bar.');}
  }
  return <section className="qr-issuer" aria-label="Public site check-in QR">
    <div className="qr-issuer-heading"><div><span className="eyebrow">MYVISITOR / WALK-IN ACCESS</span><h2>Welcome new visitors, in one scan.</h2><p>Generate one displayed site QR for your arrival desk or guard post. Each visitor receives their own private, single-use registration form—no app or account needed.</p></div><div className="qr-issuer-symbol" aria-hidden="true">⌗</div></div>
    <div className="qr-steps" aria-label="How visitor check-in works"><span><strong>01</strong> Display QR</span><span><strong>02</strong> Guest registers</span><span><strong>03</strong> Guard checks in</span></div>
    {error && <p role="alert" className="error">{error}</p>}{message && <p role="status" className="success">{message}</p>}
    {!link && <div className="qr-issuer-empty"><span className="qr-placeholder" aria-hidden="true">▦</span><div><strong>Ready for your first arrival?</strong><p>Use your published visitor form. The shared site QR remains valid for 24 hours or until revoked.</p></div></div>}
    {link && <div className="qr-display" id="visitor-qr-print">
      <div className="qr-print-sheet"><span className="eyebrow">SMARTTOWNSHIP · MYVISITOR</span><h3>Welcome! Check in here.</h3><img src={qr} alt="Scan this site-specific QR to start your own visitor registration" width="280" height="280"/><p>Scan with your camera to complete the visitor form.</p><strong>NO APP REQUIRED</strong><small>Fictional demo environment · Entry still requires guard verification</small></div>
      <div className="qr-display-actions"><h3>Display this at the entrance</h3><p>The public QR can be scanned by multiple arriving guests. Each starts a separate private, time-limited registration. Rotating the QR invalidates the previous displayed link, not registrations already started.</p>
        <a href={link} target="_blank" rel="noreferrer">Test walk-in registration ↗</a>
        <div className="qr-actions"><button type="button" className="secondary" onClick={() => void copyLink()}>Copy visitor link</button><button type="button" className="secondary" onClick={() => window.print()}>Print QR poster</button></div>
        <button type="button" className="secondary" disabled={busy} onClick={() => void change(true)}>Revoke public QR</button>
      </div>
    </div>}
    <div className="qr-actions"><button type="button" disabled={busy} onClick={() => void change(false)}>{busy?'Working…':link?'Rotate public QR':'Generate walk-in QR code'}</button></div>
    <p className="qr-issuer-footnote">Private resident invitations are separate. Never place personal invitation QRs on public signage. This prototype uses fictional registrations and no physical identity verification.</p>
  </section>;
}

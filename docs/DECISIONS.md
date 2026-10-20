# Decisions

- Continue Phase 2 with a controlled field catalog and immutable forms rather than unrestricted text/schema editing. Scope allows purpose/select, party-size/number, arrival/date, organization/text and safety/checkbox with required flags. Sensitive/arbitrary fields remain blocked pending reviewed collection requirements. No AI/provider dependency is introduced.
- Put answers in a separate RLS-enabled table with audited purpose-specific reads, not extra columns exposed through the existing visits select. Preserve old invitation behavior, enforce requirements even through the legacy RPC, and retain schema history after answer anonymization.
- Use an additive migration, per-site publish lock, expected version and idempotency key. Existing memberships are not upgraded. Fresh fictional managers/admins get the explicit form-management grant.
- Per user steering, SmartTownship development/preview/browser tests use strict port 5174. Reserve 5173 and 5000 for AppointHub. The optional API defaults to 3001; API test servers use OS-assigned ports. AppointHub files and processes were not modified or stopped.

- No pre-existing application or Git metadata was found; the protected environment directories were not read or modified.
- User deployment requirements override Next/Nest/Redis: Vite React + Supabase PostgreSQL/Auth/Realtime/Storage; one optional Node bridge. No always-on API, queue, paid maps or SMS dependency.
- Domain mutations use PostgreSQL security-definer RPCs with explicit authorization and pinned search paths. Tables have select-only RLS and no client direct mutation grants. Membership provisioning is trusted setup only.
- Browser Supabase publishable key is intentionally public; service role and device HMAC secrets are server-only. Sessions use Supabase bearer tokens, not custom cookie authentication; XSS prevention and session lifetime remain release-review requirements.
- Parking v1 is zone-counter data only: no fabricated bay precision. SMS and MQTT are unavailable pending provider configuration. Visitor QR verifies an invitation, not identity.

## Verification continuation

- npm diagnostics now isolate the failure to socket connect: DNS succeeds, local cache log writes succeed, approved IPv4/IPv6 HTTPS attempts both return EACCES, and PowerShell HTTPS also cannot connect. Do not apply cache chmod, disable TLS verification, change registries or alter security policy to disguise this blocker.
- Keep the native ESM backend, replacing its two library dependencies with native HTTPS PostgREST and one shared strict TypeScript event validator. This reduces the deployed bridge dependency surface and permits real HTTP verification while frontend dependency installation remains blocked. It does not substitute a fake database for Supabase.
- Build emits backend distribution files and syntax-checks them; a child-process smoke test boots that distribution. Node 25.5.0 was used here; target Node 22.18.0 still needs verification.
- Additive migrations supply service-only deployment inspection, same-site membership foreign keys, paired occupancy/timestamp constraints and idempotent shift start preserving GPS throttle timestamps. They are authored but not yet applied.

## Hosted-only development steering

- User confirmed normal Windows PowerShell reaches npm and explicitly chose hosted Supabase. Stop network/Docker retries and do not change Windows security. Installation runs in the user's normal terminal; the default migration/test scripts use pg directly over certificate-verified TLS, no Docker/CLI dependency.
- Use a session pooler (5432) or reachable direct DB, not the transaction pooler (6543), because migration locks and SQL tests need a persistent session. Migration versions/hashes are recorded in an RLS-protected private ledger. Dedicated development-only guards remain mandatory.
- Shared HTTP headers now distinguish modern opaque Supabase keys from JWTs, following the official API-key contract. Opaque keys use apikey only; user JWTs use Bearer. Native tests cover header selection without claiming a live hosted pass.
- Added Playwright setup/mobile and hosted separate-context workflows; existing Edge can be used without downloading a new browser. Missing credentials fail explicitly rather than skipping hosted scenarios. These browser suites are not yet executed.

## 2026-10-20 local verification

- User-installed dependencies and lockfile are verified. CI now uses npm ci. Native Vitest config loading avoids inaccessible parent traversal; lint scans explicit source paths and excludes protected environment directories.
- Production browser execution found and fixed a genuine import.meta.env alias startup failure. Browser checks compile production code, own preview shutdown directly on Windows and use workspace-local transform caches.
- Browser artifacts are isolated from deployable output. Test-only HTTP fixtures validate UI contracts and capability controls without introducing a production simulator bypass; they do not stand in for RLS/hosted evidence.
- Scoped metadata audit UI reuses existing audit.read RLS. Driver controls require capability and assignment. Supabase HTTP redirects are refused and test rejection checks require the real expected SQLSTATE/status.

## Visitor records continuation

- Work continues on the earliest independent incomplete visitor slice while hosted Phase 0/1 gates remain blocked. Add migration 006; never edit applied migration history or widen existing membership grants. Fresh fictional manager/admin seeds explicitly include exports.visits; guard/operator seeds do not.
- The record report is masked by the database, filtered to an authorized site and limited to a 31-day window. CSV is generated from the authorized JSON with a fixed column allowlist and formula protection. No extra export-job table, downloaded-file copy, paid service or background bridge is needed for a bounded 1,000-row report.
- Use predefined purpose codes to prevent personal data entering free-text audit reasons. Audit commit precedes response; each request is separately auditable, including retries. Detailed privacy-request fulfillment, form-purpose filtering and phone search remain unavailable because the current schema does not implement those data/workflows.
- A canceled browser request may already have committed a server audit. Suppress late file downloads after leaving the site/session/component; do not imply HTTP cancellation rolls back a completed transaction. Hosted proof remains required for both RPCs and audit/rate behavior.

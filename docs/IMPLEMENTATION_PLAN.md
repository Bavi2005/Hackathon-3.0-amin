# UI redesign and pitch checkpoint — 22/23 October 2026

- [x] Inspect existing application/specification and preserve scoped workflows.
- [x] Implement red/white shell, original illustration, home, sign-in and shared module styles.
- [x] Add responsive/mobile navigation and empty-data contracts; inspect final screenshots.
- [x] Pass local build/type/lint/HTTP smoke, 84 unit, 36 runtime, 53 browser contract and 3 setup tests.
- [x] Implement guarded additive fictional pitch preparation through real authenticated APIs; document scenario and partial-failure handling.
- [x] Write detailed REDESIGN_AND_PITCH_REPORT.md with feature matrix, evidence, sample-data instructions, pitch sequence and open gates.
- [ ] Configure dedicated hosted Supabase; execute 16 migrations and 300 authored SQL assertions, real service/browser/Realtime/concurrency checks.
- [ ] Execute and rehearse the new pitch seed on that verified development project.
- [ ] Close remaining functional, dependency, target-runtime, security/privacy, load/restore and deployment gates in CURRENT_SCOPE.md and PRODUCTION_CHECKLIST.md.

Git push is authorized by the user; source publication is separate from infrastructure deployment. Final delivery records the publication outcome. Preserve AppointHub's 5173/5000; SmartTownship uses strict 5174. Historical implementation checkpoints follow.

# Current acceptance plan — 2026-10-20

The full-scope request has produced the source slices listed in CURRENT_SCOPE.md. Treat the older plans below as historical checkpoints. No phase whose gate requires hosted evidence is complete yet.

Completed independent source work: OTP and assistance (008), delegated administration (009), parking hierarchy/bays/manual expiry (010), routes and reassignment/experiment (011), privacy review/holds (012), site aggregates (013), public QR (014), tenant/site administration (015), private confirmation and metadata retention (016). MFA is integrated with Supabase's real Auth SDK. Local contracts cover acknowledged success, denial, expiry, retries and mobile layouts.

Next ordered gate: dedicated Supabase setup (user confirmed not configured), all migrations and 300 pgTAP assertions, additive fictional seed, real account/service/browser/Realtime and concurrency verification. SETUP_HOSTED.md gives exact PowerShell instructions. Keep broader functional gaps in CURRENT_SCOPE.md open; complete them against a verified foundation, then dependency/Node/security/privacy/load/restore and deployment review. Leave AppointHub's 5173/5000 alone.


# Implementation plan

Follow codex.md phase order, with the user-requested Supabase/Cloudflare deployment overriding the preferred server stack.

0. Foundation: static React, shared validation, migration tooling, CI and health endpoints. Gate: lint/typecheck/test/build and database test.
1. Identity: Supabase Auth; immutable tenant/site capability grants; RLS on every table. Gate: two-tenant and cross-site negative database tests.
2. Visitors: atomic expiring invitation redemption, QR, guard entry/exit. Gate: replay and foreign-site denial.
3. Parking: signed ingestion, ordered events, bounded occupancy, simulator and stale-to-unknown display. Gate: forgery/replay/scope tests.
4. Mobility: requests, serialized capacity-safe dispatch, shift-bound telemetry and retention. Gate: concurrency and driver scope tests.
5. Unified UI: role-aware controls, reconnect refetch, explicit failures. Gate: multi-role browser demo with Render stopped.
6. Release hardening: audit, retention, deployment runbook, dependency review. Gate: all codex.md section 17 evidence. Until then: prototype only.

No deployment, account creation, real PII collection or paid services authorized by this plan.

## Full-scope continuation requested 2026-10-20

The user requested all remaining work. Continue independent coding while hosted credentials are unavailable; do not treat that blocker as completion.

1. Visitor OTP and assistance: migration 008, server-disabled simulator, hashed expiring codes, persistent failed-attempt counter, atomic consumption, explicit guard fallback and scoped UI/negative tests. Source added; 29 browser contracts passed after fixing duplicate React keys. SQL remains unexecuted.
2. Delegated administration: migration 009, account-bound expiring staff invitations/revocation, MFA enforcement outside demo, scoped membership controls, vehicle/driver/stops and zone/device configuration. All 34 browser contracts pass; 30 SQL assertions authored and unexecuted.
3. Parking: manual override expiry/audit, facility/level/bay hierarchy, authenticated bay events, device lifecycle/health and provider boundary.
4. Mobility: fixed routes/service hours, recommendation/reassignment/decision logs, identical-demand dispatch comparison and measured results.
5. Account security, privacy requests/legal holds, scoped aggregate reporting and operational failure/recovery evidence.
6. Hosted gate: configure dedicated development, migrate, explicitly enable demo simulation, seed fictional data, run SQL/service/browser/Realtime/concurrency checks. Never substitute contract fixtures.
7. Release gate: live dependency review, target runtime, load/restore/security/privacy/pilot approvals and concrete deployment review. No deployment or real integration is authorized merely by the full-scope request.

## Previous continuation: versioned visitor forms

Source and local verification complete for Phase 2 controlled templates, required/optional fields, immutable versions, invitation-pinned schemas, typed submission, historical answer display and retention. Legacy name-only behavior is preserved and cannot bypass required fields. Publishing checks stale edits and idempotent retries. **63 unit / 28 runtime / 25 browser-contract tests, build/typecheck/lint pass.** Migration 007 and 53 new SQL assertions are authored, unapplied/unexecuted; hosted gate remains open. Sensitive/arbitrary fields remain blocked. Next independent slices: OTP simulator/provider boundary and guard assistance. Per user steering, use strict port 5174 and leave AppointHub's 5173/5000 untouched.

## Visitor records continuation — 2026-10-20

Hosted credentials remain absent; Phase 0/1 database gates are still open. The next independent Phase 2 slice has source and local tests for scoped visitor search and masked export: bounded filters, pagination, server read/export capabilities, required purpose/audit, row/rate limits, safe CSV, failure/empty/loading states and cancellation. Migration 006 and 36 SQL assertions are authored but unapplied/unexecuted; real-service and hosted browser checks are authored, not passed. Local 23 unit / 28 runtime / 19 browser-contract tests and build/typecheck/lint pass. Existing invitation/guard and other module paths remain covered. The slice stays behind the hosted gate. Form templates/versioning, OTP and guard-assisted registration remain next in Phase 2.

## 2026-10-20 checkpoint

Dependencies and lockfile are available. Local compilation/lint/unit/native HTTP and production-browser setup/contract gates pass. Phase 0/1 database integration gates remain open: no hosted project configuration is present, and UI fixtures do not establish tenant isolation. The next ordered acceptance work is to apply migrations on the dedicated hosted development project, execute pgTAP/real separate-account workflows and then complete remaining module/admin scope. See PROGRESS.md for exact evidence and exclusions.

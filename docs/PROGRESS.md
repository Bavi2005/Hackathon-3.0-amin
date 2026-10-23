# Red-and-white redesign checkpoint — 22/23 October 2026

UI redesign and local checks are complete; hosted/product release gates remain open. This checkpoint supersedes historical status/counts below, including old statements that Git metadata is unavailable. The base source was published by the user as bb3bc8d; the redesign's actual publication result is recorded in the delivery message.

Changed: new AppShell, HomeDashboard, Welcome, Icon and original TownScene SVG components; shared superapp.css and main.tsx integration; new responsive/mobile navigation contracts; guarded scripts/seed-pitch.mjs with five configuration/target tests; package script and Playwright match updates. Existing scoped workflows remain connected. Added REDESIGN_AND_PITCH_REPORT.md and fictional screenshot evidence; updated setup/scope/plan/release documents.

Final serial verify:local run at 2026-10-22T15:46:28.597Z: 84 unit, 36 runtime, 53 browser contract and 3 setup tests pass; builds, TypeScript, lint and actual backend HTTP smoke pass. Aggregate exit 1: nine groups pass, SQL/services/audit remain blocked. Initial redesign browser run was 52/53 due an obsolete heading assertion; final full run passes. Final desktop home/login and phone home/parking screenshots were visually inspected after readability adjustments.

The pitch command prepares fictional visitors, trips, a timetable and parking through authenticated RPCs, with project/demo checks and an exclusive per-site receipt. Its missing-config guard was exercised; no hosted scenario was run or claimed. No schema/security relaxation, provider connection, deployment, real data collection or AppointHub change occurred. Browser work stayed on strict 5174.

Next: access the dedicated Supabase project documented in newer GitHub commits, confirm the 16 applied migrations through the ledger, execute 300 authored SQL assertions and real service/browser tests, then run and rehearse demo:pitch. Full gaps and pitch instructions are in REDESIGN_AND_PITCH_REPORT.md. This is a locally tested prototype, not a fully completed product.

# Current checkpoint — full-scope continuation, 2026-10-20

**Not fully finished.** User confirmed hosted Supabase is not configured and requested exact setup assistance. The canonical Windows guide is SETUP_HOSTED.md. Current source and functional gaps are explicitly listed in CURRENT_SCOPE.md; older checkpoints below are historical.

Added migrations 008–016 and end-to-end source/UI contracts for OTP/guard assistance; staff, assets, sites and tenant administration; MFA; parking hierarchy/bays/manual expiry; routes/reassignment; privacy review/holds; site reporting; public site QR and refresh-safe visitor confirmation. Added a reproducible fixed/adaptive dispatch experiment and versioned signed bay ingestion. Fresh seeds carry explicit grants; existing accounts are unchanged. Changed components/contracts, seed/service/browser/SQL tests, CI configuration and docs. No deployment, real data, paid service, hardware connection or AppointHub modification occurred.

Final local verification is recorded in TEST_EVIDENCE.md. The serial run follows Windows allocation failures when several checks were launched together. Vitest now caps workers at two. A revoked-QR browser test now waits for server acknowledgement before navigating; early navigation had cancelled the request. The prior visitor slice also fixed duplicate React keys. SQL lock order was reviewed around site changes, QR rotation, assignment and privacy retention, but database correctness remains unverified until execution.

16 unapplied migrations; 300 authored SQL assertions; 20 public application tables. Hosted service/browser/Realtime, dependency audit, target runtime, performance/restore and production approval gates remain open. Core browser tests bind only strict 5174; optional API smoke uses ephemeral ports. No Git metadata is available, so no commit/diff is claimed.


﻿# Progress — 2026-10-20

## Active full-scope continuation

Work is ongoing, not complete. Migration 008 and UI add optional OTP simulation and guard-assisted registration. Runtime simulation is disabled by default in a private deployment setting, and cannot be enabled in production or by browser grants. Codes are HMAC-hashed, expire in five minutes, have five persisted attempts, a 60-second resend cooldown and three requests per invitation/hour. Registration atomically consumes verification. Guard assistance requires explicit site capability, valid invitation, typed historical form, notice, reason and entry-policy acknowledgement; it remains pending entry and does not claim phone/identity verification.

Local evidence at the visitor checkpoint: 63 unit, 28 runtime and 29 Edge UI contract tests passed. Browser tests exposed duplicate sibling React keys that duplicated guard records; the key was fixed before the passing run. SQL has 34 new authored assistance assertions, not executed.

Migration 009 and administration UI add scoped delegated staff invitation/acceptance/revocation, membership disable/update, off-shift fleet editing, stops, zone capacity and device registration/suspension. Real accounts must already exist; this is not an email-delivery or account-creation provider. Privileged staff changes require MFA outside explicitly enabled development simulation. Thirty SQL assertions and five browser scenarios are authored; this slice is under verification. No existing memberships were silently upgraded; fresh fictional seeds receive explicit grants.

All owned browser work stays on strict 5174. No AppointHub changes, deployment, hosted data mutation, paid provider or real personal-data collection has occurred. Remaining independent coding and external release gates are tracked in IMPLEMENTATION_PLAN.md.

## Latest continuation: versioned visitor forms and port isolation

**Still incomplete; prototype, not production-ready.** Added controlled residential/office/contractor/event templates and a field builder, immutable per-site form versions, invitation-pinned public form loading, typed answer submission, authorized historical answers, and answer retention. Existing name-only invitations remain valid; the legacy registration endpoint delegates to validation and cannot bypass required fields. Publishing includes a site lock, expected-version conflict checks and idempotency key. Raw answers have separate RLS-protected storage and audited RPC reads; they are excluded from general visitor lists and masked CSV exports. Phone/plate/identity-document/arbitrary fields remain unavailable pending reviewed collection policy.

Completed local checks: **63 unit tests, 28 runtime tests, 25 Edge UI contract tests**, production frontend/backend build, TypeScript and lint. New browser coverage includes publish/history, rejected/stale edits, version-pinned guest fields, failed resolution/submission, and historical/retained answers. Screenshots of the builder and guest page at 360px were visually inspected; forms are readable without body overflow. UI tests use explicit synthetic service responses and prove neither SQL enforcement nor real Realtime. Two select locators and an invitation-fixture timing race were corrected before the final passing run.

Database gate remains blocked: `npm run test:integration` exited 1 at its environment guard before SQL. **Seven unapplied migrations and 136 authored pgTAP assertions** now exist, including 53 new form assertions. Hosted service/browser scenarios were extended but remain unexecuted. Fresh fictional manager/admin seeds include visits.forms.manage; existing membership grants are unchanged. Deployment diagnostics now expect 15 application tables. No secrets were read, no hosted migration/seed/deployment or real-data collection occurred, and no Git metadata exists here.

User steering: reserve **5173 and 5000 for AppointHub**. SmartTownship dev/preview/browser defaults and local Auth URLs now use strict **5174**. Its optional API defaults to 3001; API tests use ephemeral ports. The original 5173 browser run was stopped. Read-only netstat/Get-Process inspection found 5000 held by PID 19812 and our 5174 test server by PID 22016 at that checkpoint; WMI could not identify the 5000 command line even after approved inspection. No AppointHub files/processes were changed or stopped. After the final browser run, netstat showed no listener on 5173 or 5174; no persistent SmartTownship server was left running.

Changed files: new `GuestRegistration.tsx`, `VisitorFields.tsx`, `VisitorFormManager.tsx`, `VisitFormAnswers.tsx`, `packages/contracts/visitor-forms.ts`, migration 007 and form unit/SQL tests; updated main UI/styles, seed, real-service/browser fixtures/scenarios, Vitest/Playwright/browser runner, package scripts and Supabase local Auth configuration. Plan/evidence/API/architecture/security/privacy/decisions/setup/README/release documents updated.

Next independent coding: safe OTP simulator/provider boundary and guard-assisted registration, then remaining staff/asset/admin and dispatch scope. Next verification gate: configure dedicated hosted development, apply additive migrations and run all SQL, real-service and multi-user browser scenarios. Full privacy workflows, real integrations, security/dependency/runtime qualification, load/recovery/restore and pilot approvals remain open. This is locally tested source, not a completed deployed product.

## Previous continuation: visitor records search and restricted export

**Not fully finished; prototype, blocked for production.** Added the next Phase 2 slice in source while preserving existing invitation, guard, mobility and parking paths. No hosted credentials are present in the process, no protected environment files were read, and no migration, seed, deployment or real-data collection was performed. This directory has no Git metadata, so no Git diff/commit is claimed.

New functionality: MyVisitor site-record search by Malaysia registration dates, status and literal name/reference; masked, paginated results; restricted masked CSV download with a required purpose. Migration 006 checks tenant/site membership, requires read plus export grants, enforces 31-day/1,000-row/10-per-hour bounds, and commits export audit metadata with the result. Search terms/names are not audited. The UI handles empty/loading/failure states, neutralizes CSV formulas and cancels late downloads after navigation/site/account changes. Existing memberships receive no new privileges; newly seeded fictional managers/admins explicitly receive exports.visits.

Verification this continuation: **23 Vitest tests**, **28 native tests**, **19 Edge UI contract tests**, production frontend/backend build, TypeScript and ESLint pass. New UI coverage includes actual CSV downloads, denial/no-file behavior, pagination, 360/768/1440px overflow and cancellation. Synthetic browser responses do not establish SQL authorization or persisted audit correctness. Lint initially flagged the intentional control-character defense regex; a documented, narrowly scoped exemption fixed it.

`npm run test:integration` was rerun and stopped at the dedicated-development environment guard, exit 1, before SQL execution. There are now **six unapplied migrations and 83 authored pgTAP assertions** (47 existing + 36 visitor-record assertions). The real-service runner and hosted browser scenario now cover search, masked export and forbidden scope; they remain unexecuted. The earlier aggregate verification report is historical and was not regenerated. Live audit, target Node runtime and production gates remain open.

Changed source: `apps/web/src/VisitorRecords.tsx`, `main.tsx`, `style.css`; `packages/contracts/visitor-records.ts`; `supabase/migrations/202610200006_visitor_records.sql`; fictional seed and real-service runner. Changed verification: visitor unit/SQL tests, browser contract fixture/tests, hosted browser scenario and Vitest configuration. Updated plan, evidence, API/security/privacy/decision/setup/release documents and README.

Next: configure the dedicated development project using SETUP_HOSTED.md, apply additive migrations, run SQL/real-service/hosted-browser checks with the updated fictional seed, and fix failures. Old fixtures need a new additive seed or explicit provisioning of intended grants; migrations never upgrade memberships. Then continue Phase 2 forms/versioning, OTP/provider abstraction and guard-assisted registration. Broader admin/asset, privacy, dispatch comparison, integration, load/restore and approval scope remains. **This slice is locally verified source, not a fully verified deployed feature under codex.md section 17.**

## Previous checkpoint (historical evidence)

Status: local build/tooling/browser gates now pass. Hosted database and production qualification remain incomplete. The user's goal is a secure deployed application; no deployment, production-readiness claim, real personal-data collection, purchase or hardware connection occurred. Local Docker is not required.

## Verified checkpoint

The user installed dependencies in normal Windows PowerShell. `npm ls --depth=0` confirms all declared packages; package-lock.json is present and its dependency declarations match package.json.

Final `npm run verify:local -- --audit-unavailable` completed at 2026-10-19T16:38:01Z (2026-10-20 00:38 MYT), exit 1: **9 command groups pass, 3 remain blocked**. Results are in ignored `.local/verification-results.json`.

Passing: backend distribution build and actual child-process HTTP smoke, frontend production build, TypeScript (including browser test sources), ESLint, 5 Vitest tests, 28 native HTTP/security/configuration tests, 3 production-build Edge setup/mobile tests, 14 production-build Edge UI contract tests. UI contracts use explicit synthetic HTTP fixtures; no Supabase Auth/RLS/data isolation pass is inferred.

## Bugs found and fixed

- Actual production browser startup was blank: Vite does not substitute environment values through an aliased import.meta object. Replaced it with direct import.meta.env access and added client types. Browser tests failed before the correction and pass afterward.
- Lint's broad root scan attempted a protected environment directory. Scope now names source/config paths and ignores environment/private/generated directories; no protected content was read. Fixed URLSearchParams globals through explicit Node imports.
- Vitest config bundling hit denied parent-directory access even after approved escalation. Its supported native config loader passes all five tests.
- Dev dependency optimization had similar restricted traversal. Browser tests now use production builds/preview, exposing the real startup defect instead of depending on the optimizer.
- Playwright's system-temp cache was inaccessible; its cache now stays under ignored workspace storage. Windows shell-managed preview teardown hung after tests; the wrapper now owns and closes preview directly. Final browser commands exit 0 cleanly.
- Test bundles are isolated from the deployable apps/web/dist output.
- Driver shift controls now require fleet.drive plus assigned vehicle ownership; server-side guards already enforce both.
- Added an authorized audit view for operator/admin/manager capabilities, displaying only allowed metadata. Visitor/ride/audit queries order recent records first.
- Supabase adapters refuse redirects so credentials cannot be forwarded; unavailable or missing RPC/schema endpoints now produce dependency failure rather than falsely appearing to be event rejection.
- Hosted permission tests now demand the expected status and SQLSTATE; outages, missing endpoints and expired authentication cannot count as successful authorization denials. Concurrent capacity rejection must specifically be Vehicle full. Invitation format assertions suppress token values in failures.

## Module/role verification boundaries

The 14 browser contract tests exercise invalid login, QR generation/fragment routing/guest submission/replay, guard entry/exit, booking acknowledgement and cancellation, dispatch IDs, driver shift/boarding/completion/simulated GPS, parking count/expiry, forbidden UI actions, audit capability controls, logout and authenticated layouts at 360/768/1440px.

Contract roles include operator, admin, manager, guard, driver, resident, dispatcher and parking staff. These test real compiled UI behavior against explicit synthetic responses, not real account security. The separate hosted runner still needs the genuine two-tenant accounts created by seed before actual Auth, RLS, concurrency, retention, Realtime and storage permissions can be verified.

## Hosted configuration needed

No Supabase process variables or browser .env.local were configured at the check. Required: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY (server only), SUPABASE_DB_URL (development session-pooler URI with password), DEMO_PASSWORD >=16, APP_ENV=test and DEMO_SEED_ACK=fictional-data-only. An official CA file/PEM is optional if system trust is insufficient. Do not paste secrets into chat. SETUP_HOSTED.md contains secure normal-PowerShell prompts. Process variables in another terminal do not automatically reach this already running agent.

Five additive migrations and 47 pgTAP assertions remain unapplied/unexecuted here. `npm run test:integration` and `npm run test:services` fail their explicit configuration guards, not their database assertions. `npm run test:e2e` also fails its hosted environment guard before launching a browser. None is marked passed.

## Dependency security and deployment

Live npm audit failed at the advisory endpoint, including the approved retry. The offline command printed zero findings without proving a fresh advisory query, so it is not accepted as a security pass. No repeated retry was made by the final verification command; audit was explicitly recorded blocked. User should run npm audit --audit-level=high in normal PowerShell and provide redacted findings.

CI now uses npm ci and runs setup plus UI contract browser tests; the manual hosted development job uses protected environment secrets. Render and CI YAML parse locally. Cloudflare settings and optional Render manifest are prepared, not deployed. Runtime target Node 22.18 has not run here (verification used Node 25.5.0).

## Next ordered work

1. Configure the dedicated hosted development project securely; apply migrations and run pgTAP, additive fictional seed, real-service and genuine multi-role browser scenarios. Fix actual database/role/streaming failures. Do not substitute UI fixtures for that evidence.
2. Complete the live dependency audit and address findings; execute the pinned runtime and hosted CI.
3. Complete remaining acceptance scope: visitor forms/OTP, privileged account/asset administration, exports/privacy flows, dispatch experiment, integration adapters and comprehensive negative/Storage/session/recovery/load tests.
4. Verify actual deployment/TLS/CSP, Render-sleep behavior, retention, backups/restore, privacy/security and pilot approval before asking for concrete release/deployment approval. No production reliability/security certification is claimed.

Final artifact check: setup browser tests passed again (3/3), UI contract browser tests passed again (14/14), and TypeScript/lint passed. Separate screenshot directories preserve both runs. Resident/admin mobile and admin desktop screenshots were visually inspected; authenticated images remain explicitly fixture-backed evidence.

## Changed files this checkpoint

Frontend main/client types and audit view; Node adapter/imports; strict rejection helper and service tests; browser runner/fixtures/contract tests/hosted selectors; package scripts and existing lockfile verification; lint and Playwright config; CI; README, setup, plan and evidence documents. All existing functionality and protected environment paths were preserved.


## 23 October: judge-facing fictional demo pass (main)
- Added safe fictional sample activity to the connected development Supabase database: 15 visits, 22 ride records, 3 routes, 4 vehicles, 2 parking facilities, 6 zones and 10 bay sensors.
- Published a fictional visitor form and activated a development-only per-minute parking pulse; inspected successful cron executions. SQL sources committed under scripts/.
- Promoted new-visitor walk-in QR issuance to MyVisitor with visible poster, print, copy/test and revoke/rotate controls. Underlying token-based RPCs remain unchanged.
- Added parking digital twin, operator aggregate pulse and a data-backed mobility route network. Explicitly label simulation, freshness and missing ETA.
- See HACKATHON_SUBMISSION_CHECKLIST.md for unimplemented user-requested features, outstanding hosted verification and slide preparation.
- No browser-based verification of latest Render deployment or new GitHub Actions run completed from this environment; do not claim launch success.

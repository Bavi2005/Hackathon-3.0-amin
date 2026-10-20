# Test evidence — 2026-10-20

## Final local run for repository publication

At 2026-10-20T02:25:53Z, `npm run verify:local -- --audit-unavailable` completed with **9 command groups passed, 3 blocked**, exit 1. The ignored `.local/verification-results.json` records exact exits/timing. Node was 25.5.0.

Passed: backend build and actual child-process HTTP smoke (liveness 200, unconfigured readiness 503); **31 native runtime/HTTP/config tests**; TypeScript; ESLint; **84 unit tests across six files**; frontend production build; **3 Edge setup/mobile tests**; **50 Edge UI contract tests**. Browser contracts use synthetic HTTP responses, not hosted Auth/RLS/Realtime. Browser port is strict 5174; API tests use ephemeral ports.

Blocked: hosted SQL and real-service runners exited at their environment guards before connecting. The user confirmed Supabase is not configured. Live dependency audit was explicitly recorded unavailable after the prior endpoint denial, not retried or declared safe. **16 migrations and 300 authored pgTAP assertions** await hosted execution. The latest SQL-only addition grants trusted seed/bridge access independently of hosted defaults and adds one assertion; it is also unexecuted.

Prior failures: parallel typecheck/unit/build hit Windows allocation/spawn errors; serial rerun passed after limiting Vitest to two workers. The first 50-browser run passed 49 and failed revoked-site-QR because navigation cancelled the unacknowledged revocation. The test now waits for success, and all 50 passed. An earlier Edge process crash also required a rerun. None closes hosted or production gates.

The dispatch experiment completed with fictional event logs and derived metrics; input hash and tradeoffs are in DEMO_SCRIPT.md. Latest mobile screenshots were generated, but no additional visual-inspection claim is made. Current functionality and gaps are in CURRENT_SCOPE.md. Entries below are historical.

## Full-scope continuation in progress (historical)

Visitor OTP/assistance checkpoint: `npm test` 63 pass, `npm run test:runtime` 28 pass, `npm run typecheck` and `npm run lint` pass, `npm run test:e2e:contract` 29 pass (45.3s). Tests use Edge against a production build and explicit synthetic responses, not real Supabase. The first run was 27/29: duplicate sibling React keys caused repeated visitor-record panels. Corrected the key, then all 29 passed.

Administration checkpoint: all 34 browser contract tests passed (42.7s), including vehicle/stop/zone/device saves, failed-save retry identity, staff invite/revoke/disable, token acceptance rejection and narrow/mobile layouts. A test-match ternary typo initially prevented browser launch; it was corrected before the passing run. TypeScript and lint passed.

Migration 008: 34 authored pgTAP assertions. Migration 009: 30 authored pgTAP assertions. Neither migration nor SQL suite has run on PostgreSQL. There are nine migrations and 200 authored SQL assertions. No hosted pass or production readiness is claimed.

## Previous continuation: versioned visitor forms

Environment: Windows, Node v25.5.0, installed Edge; no hosted configuration, live site data or external provider. All browser verification now uses **127.0.0.1:5174**; 5173/5000 are reserved for AppointHub. No AppointHub files or processes were modified/stopped.

| Command/check actually run | Result |
|---|---|
| npm test | PASS, exit 0: **63 tests / 4 files**; 40 new controlled-form/schema/answer cases. |
| npm run test:runtime | PASS, exit 0: **28 native HTTP/security/configuration tests**; localhost servers bind ephemeral ports. |
| npm run test:e2e:contract | Final PASS, exit 0: **25 Edge tests**, 47.8s, production build on port 5174. |
| npm run build | PASS, exit 0: backend and frontend, 153 frontend modules. |
| npm run typecheck | PASS, exit 0, including new UI and hosted/contract browser sources. |
| npm run lint | PASS, exit 0. |
| node --check seed-demo.mjs / verify-supabase.mjs / run-browser.mjs | PASS; syntax only. |
| New SQL plan count | 53 authored assertions match plan(53); **not SQL execution**. |
| npm run test:integration | BLOCKED, exit 1 at APP_ENV/DEMO_SEED_ACK guard; no database assertions executed. |
| Builder and guest 360px screenshots | Visually inspected; readable form fields/history with no body clipping. Synthetic fictional responses only. |
| Final read-only netstat check | No listening entry on 5173 or 5174 after browser teardown. |

The first browser run was interrupted to honor the port change. A subsequent run exposed a label selector including select-option text; new tests now use the accessible combobox role. Another run had 24 pass/1 fail because its fixture changed the active form before the invitation request was acknowledged; awaiting the rendered private link fixed the race. Final 25/25 passed. These failures/interrupted runs are not counted as passes.

New browser scenarios: manager publish/reuse/history; server acknowledgment and draft preservation; stale-editor rejection; invitation-pinned required fields and typed answers after a later publish; unavailable invitation with retry; rejected submission without success; authorized historical answers and retention message. Existing role cases assert form-management visibility. Unit coverage includes catalog/schema tampering, blocked sensitive fields, duplicate keys, wrong/missing types, required checkbox, integer bounds, leap/calendar dates, unknown answers and configured-field-only collection.

Migration 007 and **53 new SQL assertions remain unexecuted**. Total: seven unapplied migrations / **136 assertions across five pgTAP suites**. SQL covers anonymous/role/site/tenant denial, publishing idempotency/conflicts, immutable history/invitation bindings, legacy bypass rejection, validated atomic redemption/replay, audited answer reads, response/schema binding, retention and new-table RLS. Hosted service and browser scenarios now exercise these flows, but neither was executed. No fresh advisory scan, target Node 22 run, hosted migration, deployment, provider call or production qualification is claimed.

Port incident evidence: OS WMI inspection failed with access denied, including the approved read-only attempt. Native netstat showed 5000/PID 19812 separately from the owned 5174/PID 22016 test server. Get-Process showed both were Node; command-line/project identity of PID 19812 remained unknown. No kill command was issued for it. This evidence does not establish which AppointHub process caused the user's duplicate bind.

Artifacts: `test-results/contract/contract-UI-contract-manag-0a7b8-ions-and-can-reopen-history/visitor-form-builder-360.png` and `test-results/contract/contract-UI-contract-guest-ac86f-m-and-submits-typed-answers/visitor-versioned-guest-360.png`. The older aggregate verification JSON was not regenerated; earlier entries below are historical.

## Previous continuation: visitor records

Windows / Node v25.5.0 / installed Edge; same workspace dependencies. No hosted credentials or database used. These results supersede local counts below; the older aggregate report was not regenerated.

| Command/check actually run | Outcome |
|---|---|
| npm test | PASS, exit 0: 3 suites / **23 tests** (18 new visitor date/CSV cases plus 5 existing). |
| npm run test:runtime | PASS, exit 0: **28 native HTTP/security/configuration tests**. |
| npm run test:e2e:contract | PASS, exit 0: **19 Edge UI contract tests**, 33.2s; existing 14 plus 5 visitor-record scenarios. |
| npm run build | PASS, exit 0: backend build and frontend production build (148 modules). |
| npm run typecheck | PASS, exit 0. |
| npm run lint | PASS after resolving no-control-regex with a documented narrow exemption for formula-prefix defense. |
| node --check scripts/verify-supabase.mjs and scripts/seed-demo.mjs | PASS; syntax only, not hosted execution. |
| Count visitor-record SQL assertions against plan | 36 statements match plan(36); static count only, **not execution**. |
| npm run test:integration | BLOCKED, exit 1: APP_ENV/DEMO_SEED_ACK development guard; no SQL executed. |

Unit cases cover Malaysia/UTC boundaries, inclusive 31-day limits, leap/invalid/reversed dates, CSV commas/quotes/newlines, column allowlist, empty export and formula/control prefixes. Browser contracts cover exact filters, pagination, masked results, empty/error states, invalid dates, mobile overflow at 360/768/1440px, actual CSV contents, waiting for server acknowledgment, denied export/no download/success, retry, and cancellation on navigation. Six role cases now check search/export visibility. These are synthetic response contracts, not Auth/RLS proof.

Migration 006 and **36 new pgTAP assertions remain unexecuted**: six unapplied migrations / 83 authored assertions across four suites. SQL cases cover anonymous/resident/guard/manager access, cross-site/tenant/missing-site denial, masking, literal filters, paging, invalid bounds, read plus export grants, inactive membership, purpose/row/rate limits and audit protection. Real-service and hosted browser coverage was extended but not executed. Existing fixtures need explicitly scoped export grants or a fresh additive fictional seed; migrations never silently grant privileges.

No fresh dependency audit, setup-browser rerun, target-runtime run, migration, live hosted workflow or deployment occurred. Prior setup evidence remains below. One seed-edit command failed PowerShell quoting before execution; apply_patch performed the change and syntax checks passed. No secrets or existing data were affected.

## Previous checkpoint (historical results)

Environment: Windows, Node v25.5.0, npm 11.8.0, installed Microsoft Edge. Target Node 22.18 is not verified. User-installed node_modules/package-lock.json are now present. No hosted Supabase credentials, live site data or hardware was used. Protected environment paths were not read.

## Final checkpoint

`npm run verify:local -- --audit-unavailable` ended at **2026-10-19T16:38:01.722Z / 2026-10-20 00:38 MYT**, exit **1**: **9 command groups passed; 3 failed/blocked**. Actual exit codes/timings are in ignored `.local/verification-results.json`. The live audit had already failed, so the explicit audit-unavailable option recorded a blocked result, not a pass.

| Command/check | Actual outcome |
|---|---|
| npm ls --depth=0 | PASS: all declared dependencies installed at requested versions. |
| package-lock.json vs package.json dependency declarations | PASS: local consistency check. No clean reinstall was attempted over working node_modules. |
| npm run build:api | PASS, exit 0: syntax checks and generated backend distribution. |
| npm run smoke:api | PASS, exit 0: actual generated backend child process and real localhost HTTP; /healthz 200, /readyz 503 NOT_CONFIGURED; child closed. Configured database readiness not verified. |
| npm run build:web | PASS, exit 0: 146 modules; production assets emitted to apps/web/dist. |
| npm run typecheck | PASS, exit 0: strict TypeScript including application/contracts/browser test sources. |
| npm run lint | PASS, exit 0: explicitly scoped source/config files. |
| npm test | PASS, exit 0: 2 files, **5 Vitest tests**, using supported native config loader. |
| npm run test:runtime | PASS, exit 0: **28 native tests**, latest test duration 657 ms. Real localhost HTTP for bridge handling; explicit local PostgREST stubs for persistence adapter tests. |
| npm run test:e2e:setup | PASS, exit 0: **3 real Edge tests**, 4.0 s in final run; setup page at 360/768/1440px, no horizontal overflow; screenshots produced and 360px image visually inspected. |
| npm run test:e2e:contract | PASS, exit 0: **14 real Edge UI contract tests**, 29.0 s in final run; synthetic HTTP response fixtures, no live Supabase. |
| npm run test:integration | BLOCKED, exit 1 at dedicated-development/environment guard; no SQL query/migration/RLS assertion executed. |
| npm run test:services | BLOCKED, exit 1 at explicit environment guard; no real separate-account workflow executed. |
| npm run test:e2e | BLOCKED, exit 1 at hosted configuration guard before browser launch. |
| npm audit --audit-level=high --cache .npm-cache | BLOCKED: live advisory endpoint fails, including approved escalation retry. Not a vulnerability-free result. |
| npm audit --offline | Printed zero findings, but no fresh advisory lookup was proven. **Not accepted as security evidence.** |
| Render/CI YAML parse | PASS: local js-yaml parsing only, not provider deployment validation or CI execution. |
| node --check scripts/verify-supabase.mjs | PASS after token-safe assertion change; hosted workflow remains unexecuted. |

## Failures found and corrected

1. Production setup browser initially showed a blank page. Captured page error: Cannot read properties of undefined (reading VITE_SUPABASE_URL). Aliased import.meta prevented Vite environment replacement. Direct import.meta.env access fixes startup; all setup browser assertions now pass.
2. ESLint initially attempted to scan a denied .env directory; source scope/ignore rules avoid it. Explicit URLSearchParams imports fix the two actual lint diagnostics. No protected contents were read.
3. Vitest's initial esbuild config loader failed on parent-directory access, including approved retry. Supported native loader now runs all five unit tests.
4. Vite dev optimizer similarly failed restricted traversal. Browser runner uses actual production builds instead; no dependency tests were skipped as a substitute.
5. Playwright system-temp transform-cache writes were denied. Workspace-local cache works. Windows shell process-tree preview teardown then hung; owning the preview directly fixes termination and final browser commands exit 0.
6. Initial contract tests used exact label selectors that included select-option content; corrected to the actual accessible combobox names. The extended driver test initially inspected a call before asynchronous completion; it now waits for the confirmed completed state. These failures are not hidden or represented as product passes before fixes.
7. Driver controls now require both fleet.drive and assigned vehicle ownership. Scoped audit view and recent-first queries were added and included in the final passing browser/type/lint checks.
8. Bridge adapters reject credential-bearing redirects and distinguish database invariant rejection from missing/unavailable RPCs. Native HTTP regression tests pass.
9. Hosted denial checks require exact status/SQLSTATE. Native regressions prove 500/404/expired-auth responses cannot falsely pass authorization tests. Concurrent capacity failure must specifically be Vehicle full. Invalid invitation format assertions suppress token values.

## Browser contract coverage and its limits

The compiled React app and real Supabase SDK make requests intercepted by test-only response fixtures. Tests cover invalid login; QR PNG creation and guest fragment navigation; submission/replay; guard entry/exit; booking acknowledgement/no premature success; accessibility fields/cancellation; dispatch identifiers; driver shift/boarding/completion/simulated GPS; parking unknown/current/stale states; forbidden-write errors; operator/admin/manager/guard/driver/resident controls; parking/dispatcher actions; audit visibility; logout; authenticated 360/768/1440px layouts.

Fixtures live only under tests and do not create a production bypass or fake success path in the application. WebSockets are intentionally closed in this contract mode, so fallback/refetch behavior does not prove real Realtime delivery. Synthetic responses do **not** establish Auth correctness, RLS, tenant isolation, atomic capacity, retention or real sensor truth. Browser modes use isolated ignored .local/browser-dist output; they cannot overwrite deployable apps/web/dist.

Supplementary artifact-retention rerun: setup browser tests passed 3/3 (24.6 s), and UI contract browser tests passed 14/14 (1.7 min); both commands exited 0. TypeScript and lint also passed after these changes. The table timings above describe the aggregate verification run, not performance benchmarks. Screenshots are retained separately under `test-results/setup` and `test-results/contract`. Visual inspection of resident and admin layouts at 360px and admin at 1440px found readable content without clipping. Authenticated screenshots use fictional response fixtures and do not prove hosted integration.

## Hosted evidence still required

Five migrations have not been applied. The three pgTAP suites contain **47 authored assertions** (24 access, 13 visitor, 10 ingestion), all unexecuted here. Real-service tests are prepared for nine separately seeded accounts in each of two tenants, including privilege/tenant/site negatives, three parallel assignments for a two-seat vehicle, visitor lifecycle, GPS and signed ingestion to actual PostgREST. No hosted assertion is reported green.

Needed: dedicated development SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, server-only SUPABASE_SERVICE_ROLE_KEY, password-bearing session-pooler SUPABASE_DB_URL on 5432, DEMO_PASSWORD >=16, APP_ENV=test and DEMO_SEED_ACK=fictional-data-only; optional official CA if trust requires it. No secret values should be shared in chat. See SETUP_HOSTED.md secure prompts. Existing agent processes do not inherit variables from a separate normal terminal.

Still unverified: real Auth/session revocation/MFA, all-table/Storage RLS matrix, hosted multi-user/browser/Realtime/reconnect/Render-down operation, applied migrations/retention, live dependency audit, Node 22 run, actual Pages/Render/TLS/CSP deployment, provider integrations, load/restore drills and responsible privacy/security/pilot approval. Passing local contracts do not certify production readiness.

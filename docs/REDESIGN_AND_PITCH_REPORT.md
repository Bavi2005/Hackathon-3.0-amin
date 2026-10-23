# SmartTownship redesign and pitch readiness report

Checkpoint: 22 October 2026. This report describes the source and evidence available in this repository, not a deployed production service.

## 1. What is finished, and what is not

The red-and-white UI redesign is implemented and locally tested. It replaces the old presentation with a unified home, service navigation, mobile navigation, sign-in experience and shared visual styling across the existing modules. The application builds, typechecks and passes the local test suites listed below.

The whole product is **not fully finished or production-ready**. Newer commits on GitHub record that a dedicated Supabase development project was connected, all 16 migrations were applied and database health was checked on 20 October. Those events were performed outside this redesign workspace; this agent did not recheck the hosted project and had no credentials in its process. The 300 pgTAP assertions, tenant isolation, real account workflows, Realtime delivery and the new pitch seed remain unverified by this checkpoint. A passing UI contract test cannot establish SQL authorization.

The practical next milestone is a rehearsed, fictional-data demonstration on dedicated development Supabase. That is achievable without connecting actual vehicles, collecting real visitor information or purchasing SMS/maps/hardware integrations. It still requires the hosted setup and acceptance commands to pass.

## 2. The new visual design

The direction is a community super app: three everyday services together, with role-specific workspaces behind them. Red is the main action and selection colour; white cards, restrained borders and warm illustration backgrounds provide separation. Transport, MyVisitor and Parking use consistent navigation and controls.

The supplied Dribbble Flight Booking App URL could not be loaded by the reference browsing tool. This redesign therefore follows the requested travel-app quality and red/white direction without claiming a reproduction of that exact image. The township/shuttle artwork is an original SVG component in the repository, with no external image or font service dependency.

| Surface | What changed |
|---|---|
| Sign-in and first setup | Split illustration/form composition, prominent red action, clearer labels and an honest unconfigured state. Existing account authentication is preserved. |
| Desktop shell | White side rail, icon navigation, clear selected state, community header, site selection, account access and sign out. |
| Phone navigation | Home, Transport, MyVisitor, Parking and a More disclosure for permitted workspace tools. Administrative links still depend on the existing capabilities. |
| Home | Illustrated hero, working service shortcuts, recent visible activity, a compact current-record snapshot and a privacy entry point. |
| Transport | Stronger booking panel, field spacing, card hierarchy and status presentation. Configured stops and existing booking/dispatch actions are retained. |
| MyVisitor and operational forms | Shared rounded panels, clearer inputs, field groups, buttons, notices and tables. Existing invitation, guard and form-version workflows remain intact. |
| Parking | Spacious status cards, prominent observed availability and source/freshness explanations. A counter estimate is not presented as an identified free bay. |
| Accessibility and responsiveness | Keyboard focus treatment, skip link, labelled controls, reduced-motion styling and responsive layouts. This is not a complete accessibility audit. |

Final screenshots were generated from browser contract tests and visually inspected. **All records shown in these screenshots are synthetic test responses, not hosted data.** The connection footer can show polling fallback because these tests do not provide a real Realtime channel.

- [Desktop home](screenshots/redesign-home-desktop.png)
- [Phone home](screenshots/redesign-home-mobile.png)
- [Desktop sign-in](screenshots/redesign-login-desktop.png)
- [Phone parking](screenshots/redesign-parking-mobile.png)

The illustration is decorative, not a geographic map or live vehicle position. Home counts describe the currently loaded, authorized records; the underlying overview reads bounded lists, currently up to 100 records per table. These numbers must not be pitched as all-time township totals. The separate reporting module has its own bounded aggregate queries.

## 3. Feature-by-feature status

In the table, “implemented/local coverage” means source is present and relevant local tests exist. It does **not** mean the feature has passed hosted acceptance.

| Area | Implemented/local coverage | What is still unverified or missing |
|---|---|---|
| Identity and access | Supabase password login, site/role shell, explicit grants, staff invitations for existing accounts, membership changes, MFA UI and session controls. | Actual Auth/MFA and revocation timing; all database isolation tests; self-service onboarding, password recovery and email delivery. |
| Resident visitor invitations | Private links/QR, expiry/replay handling, controlled versioned forms, required answers, private confirmation and refresh handling. | Real end-to-end hosted persistence and abuse controls under load; approved real collection notices. |
| Guard operations | Assisted registration with reason/acknowledgement, separate entry/exit transitions, visitor lists, masked search and restricted CSV export. | Real multi-account authorization and audit evidence; operating procedures and pilot training. |
| Public site QR | Site QR creation and revocation; separate private visitor flows. | Real hosted race/abuse testing and field usability. |
| Visitor OTP | Explicit development simulator, expiry, attempt/resend limits and server-side verification source. | No real SMS provider or phone-delivery verification. Simulator codes are not evidence of a person's identity. |
| Transport requests | Configured pickup/destination stops, resident requests, dispatcher assignment/reassignment, capacity/accessibility checks, driver shifts and ride transitions. | Real SQL concurrency and cross-role testing; actual vehicle operations; richer incident/notification lifecycle. |
| Routes and location | Daily Malaysia timetable, configured routes, shift-bound telemetry and labelled simulated GPS. | Routing provider, live ETA, geographic route map/service areas, automatic offline redispatch and background-device GPS qualification. |
| Parking | Facilities, levels, zones, individual bays, counter observations, expiring manual counts, device configuration, simulation and freshness states. | Physical sensors, MQTT transport, public availability policy, site-map experience and ground-truth accuracy study. |
| Device bridge | Signed HTTPS ingestion, replay/order/scope checks and versioned bay input; native HTTP tests and actual local HTTP smoke. | Real provider credentials/hardware, production rotation, sustained load and deployed health evidence. |
| Administration | Staff and assets, tenant/site metadata creation and capability-specific workspace controls. | Complete tenant lifecycle/settings and provider-management workflows; hosted privilege review. |
| Privacy | Requests, independent review, access/correction, legal holds and name/answer minimization source. | Legal validation, real retention/Cron execution, backup handling and complete erasure analysis. Operational IDs and relationships can remain. |
| Reporting | Site aggregates, visible activity, audit paths and a deterministic dispatch experiment. | Real dataset validation, operational benefits, field comparisons and reliable cost quotations. |
| Deployment/operations | Builds, health endpoints, migration ledger, CI definitions and setup/recovery documentation. | Hosted deployment, CI result for this commit, target Node qualification, live dependency audit, load/recovery/restore and independent security review. |

There is no real payment system, SMS gateway, connected shuttle fleet or live public parking feed in this prototype. Those should not appear as delivered claims in the pitch.

## 4. Verification actually performed

The final aggregate run completed at **2026-10-22T15:46:28.597Z**, on Windows with Node **25.5.0** and installed Microsoft Edge. The intended Node 22.18+ runtime still needs its own qualification.

| Check | Result |
|---|---|
| Backend build | Passed. |
| Built backend HTTP smoke | Passed: actual child process, liveness 200 and missing-configuration readiness 503. |
| Native runtime/security/configuration tests | **36 passed**, including five pitch-configuration/target guard cases. |
| TypeScript and ESLint | Passed. |
| Unit tests | **84 passed**. |
| Frontend production build | Passed. |
| Production-browser setup tests | **3 passed**. |
| Production-browser module contracts | **53 passed**, including new redesign, mobile navigation and empty-data coverage. |
| Responsive checks | Home at 1440, 768, 390 and 360 pixels; existing module contracts also cover narrow layouts. Final desktop/mobile/login/parking screenshots visually inspected. |
| PostgreSQL/pgTAP | Blocked before connection. GitHub records the 16 migrations as applied to development, but **300 authored assertions remain unexecuted here**. |
| Real Supabase account/workflow tests | Blocked at missing-configuration guard. |
| Dependency advisory audit | Explicitly marked unavailable; not a security pass and not freshly retried in this run. |
| New `demo:pitch` command | Attempted; correctly stopped at its missing-development-configuration guard before network/data changes. The hosted scenario itself has not run. |

`npm run verify:local -- --audit-unavailable` returned **exit 1: nine command groups passed and three gates remained blocked**. This nonzero outcome is deliberate and must not be hidden. The machine-readable run artifact is ignored `.local/verification-results.json`; this document records the shareable evidence.

The initial redesign browser run passed 52/53. The remaining test still expected the previous Parking heading; its export-cancellation behavior was intact. The assertion now targets the Parking availability region, and the subsequent full 53-test run passed. Supporting text was enlarged after the first visual inspection. No database security pass is inferred from this work.

## 5. Can we add sample data for pitching?

**Yes.** Two separate mechanisms exist, with different purposes:

1. Browser contract fixtures provide repeatable screenshot and interaction tests without a database. They run only in the test harness and are not a public demo mode or an authentication bypass.
2. The existing `db:seed:demo` creates fictional tenants/accounts/assets in dedicated development Supabase. The new `demo:pitch` then adds a connected story through authenticated RPCs used by the application.

The new command prepares the following after setup succeeds:

| Fictional scenario | Intended demonstration |
|---|---|
| Three visitors: pending entry, on site and departed | Visitor history and distinct guard workflow states. Each starts from an actual invitation and submits the resolved form. |
| One completed shuttle trip | Request, assignment, simulated telemetry, boarding, completion and shift end through separate roles. |
| One pending trip | A fresh request the dispatcher can process during the presentation. |
| One published Hub–Mall timetable | Configured stops, daily 08:00–18:00 service hours and 20-minute headway. This is a fictional schedule, not a live service promise. |
| Mall, level, four bays and device bindings | A small, readable parking structure with two simulated free and two occupied bay observations. |
| Counter observation with occupied count 12 | Show the distinction between a zone-level estimate and individual bay sensing. Free capacity depends on the seeded zone capacity. |

The command checks the dedicated-development environment, project identity, demo tenant and database simulation setting. It refuses to interrupt an active shift or assigned/boarded site ride. An exclusive per-site receipt prevents concurrent or accidental duplicate scenario runs. It uses no destructive reset and writes no credentials to its receipt.

This is a sequence of real API requests, **not one database transaction**. A failure can leave partial fictional records or an active shift. The receipt lists completed steps; review the partial state and resolve the demo ride/shift through the app before retrying. Do not delete receipts or rerun the base seed blindly. Existing completed scenarios should be reused.

Parking observations expire after **120 seconds**. Refresh them with the labelled parking simulator immediately before presenting. Letting an observation expire and showing Unknown is a useful reliability demonstration. Never replace the expiry with permanent fictional availability just to make the screen look busy.

## 6. Exact preparation order

Follow [SETUP_HOSTED.md](SETUP_HOSTED.md) for secure PowerShell prompts and the public browser variables. Use the dedicated SmartTownship development project documented in the newer GitHub commits, and the same terminal for all configured commands. Do not paste keys or passwords into chat. Keep AppointHub's database separate. The migration command should report the 16 files as previously applied; stop and reconcile the ledger if it does not.

After the documented environment is configured, run each command separately and stop at a failure:

```powershell
Set-Location 'C:\Users\bavit\Documents\amin'
npm.cmd run db:migrate
npm.cmd run demo:configure
npm.cmd run test:integration
npm.cmd run db:seed:demo
npm.cmd run test:services
npm.cmd run test:e2e
npm.cmd run demo:pitch
```

The first six commands establish the development foundation and exercise actual accounts. Run the base seed once. The pitch command adds the story to the first seeded tenant; it does not replace those acceptance tests. If test-created active trips prevent pitch preparation, finish them in the fictional workspace before rerunning the command.

Then configure the browser using public values and start the app:

```powershell
$env:VITE_SUPABASE_URL = $env:SUPABASE_URL
$env:VITE_SUPABASE_PUBLISHABLE_KEY = $env:SUPABASE_PUBLISHABLE_KEY
$demoAccounts = Get-Content -LiteralPath '.local/demo-fixture.json' -Raw | ConvertFrom-Json
$demoAccounts.tenants[0].accounts | Format-List
npm.cmd run dev
```

Open **http://127.0.0.1:5174**. Use the generated role email and the demo password entered during setup. **5173 and 5000 remain reserved for AppointHub.** Browser tests need sole use of 5174 while they run; stop only your own SmartTownship dev server first. No AppointHub process was stopped or altered for this redesign.

## 7. Suggested seven-minute pitch

| Time | Show | Explain |
|---|---|---|
| 0:00–0:45 | New home on a phone-sized viewport | One entry point for community transport, visitors and parking; explicitly a fictional demonstration. |
| 0:45–2:15 | Resident invitation, guest submission, separate guard browser | A visitor moves from invitation to entry with scoped responsibility. Use a newly generated private invitation, not one captured in a screenshot. |
| 2:15–3:45 | Resident request, dispatcher assignment and driver transition | Different roles coordinate the same journey. State that recommendations are capacity-based and GPS is simulated; live ETA is not implemented. |
| 3:45–4:45 | Parking counter and four-bay view | Explain timestamp, source, supported granularity and the 120-second expiry. Availability is not a reservation. |
| 4:45–5:30 | Manager reporting and a denied role action | Show accountable operations and least privilege. Only claim database enforcement after hosted tests actually pass. |
| 5:30–6:15 | Reproducible dispatch experiment | Present the simulation's measured tradeoff, including its additional vehicle operating time. |
| 6:15–7:00 | Roadmap and next validation | Name the hosted validation, real integrations, mapping/ETA and pilot work still needed. |

Use separate browser profiles/contexts for resident, guard, dispatcher, driver and parking staff; a role label is not a substitute for separate authenticated sessions. Rehearse the exact sequence before the event. Screenshots are a fallback visual explanation if the hosted backend is unavailable, not proof of a functioning live service.

## 8. Claims the evidence supports

Safe today: “We have implemented and locally tested a responsive, role-aware prototype that brings three community services into one interface.” Also safe: “The pitch uses fictional records and clearly labelled simulators.” After hosted tests pass, report their exact scope and date rather than saying everything is secure.

The existing deterministic dispatch experiment reports 28/30 served with a fixed schedule and 30/30 with its adaptive simulation; average waits are 10.79 and 7.83 minutes respectively. The adaptive case uses **136 versus 112 vehicle-minutes** and lower seat utilization. Those are synthetic, reproducible results, not measured community improvements. See [DEMO_SCRIPT.md](DEMO_SCRIPT.md) for the input hash, metrics and limitations.

Unsupported claims include a live deployed township, guaranteed parking, real-time routing/ETA, verified real SMS, connected vehicles/sensors, complete regulatory compliance, production security, or real operational savings. Do not invent users, partners, adoption figures or payment functionality to strengthen the pitch.

## 9. Remaining work in priority order

1. Confirm access to the already migrated dedicated development Supabase project. Run the migration-ledger check, all SQL assertions, real service workflows and hosted multi-role browser tests. Fix any failures exposed by execution.
2. Execute `demo:pitch`, inspect actual records, rehearse the pitch and verify updates across real simultaneous accounts. Confirm simulator expiry, denied roles, revocation and network recovery.
3. Qualify the supported Node runtime, obtain a current dependency audit and inspect the repository's CI results. Local success is not CI evidence.
4. Finish product gaps in [CURRENT_SCOPE.md](CURRENT_SCOPE.md), prioritizing the demonstrated user journey: account recovery/onboarding, map/ETA integration and operational notifications when providers and scope are approved.
5. Verify retention/Cron, concurrency, load, backup/restore, privacy and independent security requirements before any production claim. Deployment remains a separate approval and acceptance step.

This redesign changes UI modules/styles and adds pitch preparation plus local coverage. The remote branch also contains a separate migration-grant correction and Render static-site blueprint that must be preserved when merging. This redesign does not relax authorization, connect providers, collect real personal data or deploy infrastructure. Git publication of the source is separate from deployment; the final delivery message records the actual push result.

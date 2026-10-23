# Redesign scope update — 22/23 October 2026

Red/white super-app UI is implemented: responsive shell, mobile bottom navigation, illustrated home/sign-in, shared module styling and real scoped activity presentation. Local checks pass: 84 unit, 36 runtime, 53 UI contracts, 3 setup, builds/type/lint/HTTP smoke. New demo:pitch source prepares fictional visitors/rides/timetable/parking through authenticated APIs, but its hosted scenario remains unexecuted. See [the detailed redesign and pitch report](REDESIGN_AND_PITCH_REPORT.md).

No database/project or external provider has been configured in this checkpoint. Existing feature and release gaps below still apply; UI completion does not close them.

# Current scope and unresolved work — 2026-10-20

Status: locally tested source, **prototype blocked for hosted qualification and production**. A database-backed feature cannot meet codex.md section 17 until its real database, multi-account and browser paths pass. No live project is configured; user confirmed this explicitly. No deployment or real integrations occurred.

| Area | Source now present | Acceptance still open |
|---|---|---|
| Identity and staff | Supabase password login, role/site shell, explicit grants, existing-account staff invitations/revocation, scoped disable/update, authenticator MFA and sign out other sessions | Real Auth/MFA/disable timing; new-user onboarding/password recovery/email delivery; session-storage security review |
| Visitors | Private invitations, public site QR creating separate flows, pinned form versions, refresh-safe minimal confirmation, OTP simulator, guard assistance, entry/exit, masked search/export | Execute SQL/hosted multi-user tests, provider OTP/SMS, abuse/notice/privacy review |
| Parking | Facility/level/zone/bay metadata, counter and individual bay observations, device binding/suspension, expiring audited manual counts, signed HTTPS bridge, stale/partial unknown states | Real sensors, MQTT broker transport/credential rotation, public unauthenticated availability policy and site-map UI |
| Mobility | Configured stops and daily Malaysia timetable, scoped shifts/GPS, capacity/accessibility validation, assignments/reassignment and decision logs, honest capacity-only recommendations | Routing/ETA provider, geographic service areas/map, automatic timeout/offline redispatch, richer en-route/incident/notification lifecycle, real device/background GPS qualification |
| Administration | Delegated staff and assets, township site creation, explicit global tenant metadata/create grant with designated initial administrator | Full tenant settings/lifecycle and provider settings/health management, approved account provisioning/step-up review |
| Privacy and reports | Independent request review, access download/correction/name-and-answer minimization, legal holds, hold-aware retention, bounded site aggregates | Legal validation; owner relationships/record IDs remain after minimization; backup handling and retention execution |
| Experiment | Executed fixed-vs-adaptive fictional comparison, identical inputs, actual event-derived metrics and reproducible input hash | Operational routing algorithm, manual-vs-QR and parking ground-truth studies, actual cost quotations |
| Operations | Builds/health, structured bridge errors, migration ledger, Cron definition, CI/test runners, setup and recovery guidance | SQL execution, real Realtime/Storage/policy/concurrency proof, load/recovery/restore, alerting, live audit, target Node and independent security review |

## Latest source additions

Migrations 008–016 implement the new paths. Components are in apps/web/src (VisitorOtp, GuardAssistance, SiteAdministration, StaffAcceptance, ParkingPanel, AccountSecurity, DispatchOptions, TransportRoutes, PrivacyRequests, SiteAnalytics, SiteCheckin, PlatformAdministration and GuestRegistration). Shared contracts include administration, parking-overview and dispatch-simulation. Native bridge accepts versioned bay observations. Seed and hosted verification scripts have matching capabilities and scenarios. No existing membership is silently upgraded by migration.

Twenty public application tables are expected by deployment_health; private challenge, request, hold, audit and settings tables deny browser table access. Authenticated writes go through scoped RPCs. Global platform metadata authority does not bypass visitor/GPS policies. Private runtime settings default to production with simulation disabled; enabling simulation is an explicit trusted development command.

## Next acceptance order

1. Follow SETUP_HOSTED.md in a new dedicated fictional-data project. Stop at any failing command and preserve redacted output.
2. Apply migrations, enable development simulators, execute all 300 SQL assertions, seed once, run real service/browser tests. Fix failures before treating these as completed features.
3. Exercise multi-user Realtime, revocation, concurrent assignment, disconnected devices and Cron. Qualify supported Node and dependencies.
4. Complete the functional gaps above in vertical slices, then load/recovery/restore and independent security/privacy review. Deployment and actual providers/pilot require concrete approval.

This list is intentional: passing local contracts is not a claim that every requested capability is fully finished.
